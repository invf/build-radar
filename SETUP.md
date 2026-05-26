# BuildRadar — Setup Guide

## Prerequisites

- Node.js 22+
- Python 3.12+
- PostgreSQL (via Supabase)
- Redis (Upstash free tier or local)

---

## 1. Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Enable PostGIS extension: Project Settings → Extensions → Enable `postgis`
3. Run `infrastructure/supabase_setup.sql` in SQL Editor
4. Copy your project URL and API keys

---

## 2. Frontend Setup (Next.js)

```bash
cd apps/web
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Opens at: http://localhost:3000

---

## 3. Backend Setup (FastAPI)

```bash
cd apps/api
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, SUPABASE keys, AI keys

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000
```

API docs at: http://localhost:8000/docs

---

## 4. Background Workers

```bash
cd apps/api

# Celery worker (processes tasks)
celery -A app.tasks.celery_app worker --loglevel=info

# Celery beat (scheduler)
celery -A app.tasks.celery_app beat --loglevel=info
```

---

## 5. First Admin User

After running migrations, create the first admin user directly in Supabase:

1. Go to Supabase → Auth → Users → Add User
2. Create user with your email/password
3. In SQL Editor:
```sql
INSERT INTO users (email, full_name, role, is_active)
VALUES ('your@email.com', 'Admin Name', 'admin', true);
```

---

## 6. Deployment

### Frontend (Vercel)
```bash
cd apps/web
vercel --prod
# Set env vars in Vercel dashboard
```

### Backend (Render)
1. Connect GitHub repo to Render
2. Use `infrastructure/render.yaml` as Blueprint
3. Set all environment variables in Render dashboard

---

## Environment Variables Required

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Supabase anon key |
| `NEXT_PUBLIC_API_URL` | Vercel | FastAPI backend URL |
| `DATABASE_URL` | Render | PostgreSQL connection string |
| `REDIS_URL` | Render | Redis connection string |
| `JWT_SECRET_KEY` | Render | Random 32-char secret |
| `OPENAI_API_KEY` | Render | OpenAI API key (optional) |
| `ANTHROPIC_API_KEY` | Render | Claude API key (optional) |
| `TELEGRAM_BOT_TOKEN` | Render | Telegram notifications (optional) |

---

## Architecture Overview

```
buildradar/
├── apps/
│   ├── web/           # Next.js 15 frontend → Vercel
│   └── api/           # FastAPI backend → Render
├── infrastructure/
│   ├── render.yaml    # Render deployment config
│   └── supabase_setup.sql  # Database setup
└── docs/
    └── architecture/  # Architecture diagrams
```

## Data Sources

| Source | Parser | Schedule |
|--------|--------|----------|
| ЄДЕССБ | `edesb.py` | Every 15 min |
| Prozorro | `prozorro.py` | Every hour |
| data.gov.ua | `data_gov.py` | Every 6 hours |

## AI Integration

- **Primary**: OpenAI GPT-4o (if `OPENAI_API_KEY` set)
- **Fallback**: Anthropic Claude (if `ANTHROPIC_API_KEY` set)
- **Schedule**: Batch analysis runs daily at 2 AM
- **Manual trigger**: POST /api/v1/admin/ai/analyze-batch

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access, user management, parser control |
| `manager` | All data access, exports, saved searches |
| `viewer` | Read-only access to all data |

All registration is invite-only — admin must send invitation email.
