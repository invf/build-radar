"""
BuildRadar local dev seed script.

Usage (from project root, with API venv activated):
    cd apps/api
    python ../../scripts/seed.py                     # list users
    python ../../scripts/seed.py admin you@email.com # promote to admin
    python ../../scripts/seed.py objects              # insert sample objects
    python ../../scripts/seed.py all                  # objects + show users
"""
import sys
import os
import uuid
import asyncio
from datetime import datetime, timezone
from pathlib import Path

# Load apps/api/.env so DATABASE_URL / SUPABASE_* are available
api_dir = Path(__file__).resolve().parent.parent / "apps" / "api"
sys.path.insert(0, str(api_dir))

from dotenv import load_dotenv
load_dotenv(api_dir / ".env")

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

DATABASE_URL = os.environ["DATABASE_URL"]


def get_engine():
    return create_async_engine(DATABASE_URL, echo=False)


async def list_users(session: AsyncSession):
    result = await session.execute(text(
        "SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY created_at"
    ))
    rows = result.fetchall()
    if not rows:
        print("No users in DB yet (users are created on first Supabase login).")
        return
    print(f"\n{'ID':<38}  {'Email':<35}  {'Role':<10}  Active")
    print("-" * 95)
    for r in rows:
        print(f"{str(r.id):<38}  {r.email:<35}  {r.role:<10}  {r.is_active}")
    print()


async def promote_admin(session: AsyncSession, email: str):
    result = await session.execute(
        text("UPDATE users SET role = 'admin' WHERE email = :email RETURNING id, email, role"),
        {"email": email}
    )
    row = result.fetchone()
    if row:
        await session.commit()
        print(f"[OK] {row.email} is now admin (id={row.id})")
    else:
        print(f"[!] User '{email}' not found in DB.")
        print("     Log in once via the app first so the row is auto-created, then re-run this.")


SAMPLE_OBJECTS = [
    {
        "id": str(uuid.uuid4()),
        "name": "ЖК Зоряний",
        "address": "вул. Хрещатик, 1",
        "city": "Київ",
        "oblast": "Київська",
        "status": "under_construction",
        "category": "residential",
        "object_type": "apartment_building",
        "total_area": 15000.0,
        "floors": 18,
        "source": "edesb",
        "source_id": "SEED-001",
        "ai_score": 85,
        "description": "Великий житловий комплекс у центрі Києва",
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Логістичний центр Борисполь",
        "address": "вул. Промислова, 15",
        "city": "Бориспіль",
        "oblast": "Київська",
        "status": "approved",
        "category": "industrial",
        "object_type": "warehouse",
        "total_area": 8500.0,
        "floors": 2,
        "source": "prozorro",
        "source_id": "SEED-002",
        "ai_score": 72,
        "description": "Сучасний логістичний хаб поблизу аеропорту",
    },
    {
        "id": str(uuid.uuid4()),
        "name": "ТРЦ Галерея",
        "address": "пр. Свободи, 22",
        "city": "Львів",
        "oblast": "Львівська",
        "status": "planned",
        "category": "commercial",
        "object_type": "shopping_center",
        "total_area": 25000.0,
        "floors": 4,
        "source": "edesb",
        "source_id": "SEED-003",
        "ai_score": 91,
        "description": "Торгово-розважальний центр у серці Львова",
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Школа №47 (реконструкція)",
        "address": "вул. Гагаріна, 8",
        "city": "Харків",
        "oblast": "Харківська",
        "status": "under_construction",
        "category": "social",
        "object_type": "school",
        "total_area": 4200.0,
        "floors": 3,
        "source": "data_gov",
        "source_id": "SEED-004",
        "ai_score": 60,
        "description": "Капітальна реконструкція загальноосвітньої школи",
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Бізнес-центр Optima",
        "address": "вул. Набережна, 5",
        "city": "Дніпро",
        "oblast": "Дніпропетровська",
        "status": "approved",
        "category": "commercial",
        "object_type": "office",
        "total_area": 9800.0,
        "floors": 12,
        "source": "edesb",
        "source_id": "SEED-005",
        "ai_score": 78,
        "description": "Сучасний офісний центр класу А",
    },
]


async def insert_objects(session: AsyncSession):
    inserted = 0
    skipped = 0
    for obj in SAMPLE_OBJECTS:
        exists = await session.execute(
            text("SELECT 1 FROM construction_objects WHERE source_id = :sid AND source = :src"),
            {"sid": obj["source_id"], "src": obj["source"]}
        )
        if exists.fetchone():
            skipped += 1
            continue
        await session.execute(text("""
            INSERT INTO construction_objects
                (id, name, address, city, oblast, status, category, object_type,
                 building_area, floors, source, source_id, ai_score, description, created_at, updated_at)
            VALUES
                (:id, :name, :address, :city, :oblast,
                 :status::object_status, :category::object_category, :object_type::object_type,
                 :total_area, :floors, :source, :source_id, :ai_score, :description,
                 now(), now())
        """), obj)
        inserted += 1

    await session.commit()
    print(f"[OK] Inserted {inserted} sample objects, skipped {skipped} (already exist).")


async def main():
    args = sys.argv[1:]
    command = args[0] if args else "list"

    engine = get_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        if command == "admin":
            if len(args) < 2:
                print("Usage: seed.py admin <email>")
            else:
                await promote_admin(session, args[1])
        elif command == "objects":
            await insert_objects(session)
        elif command == "all":
            await insert_objects(session)
            await list_users(session)
        else:
            await list_users(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
