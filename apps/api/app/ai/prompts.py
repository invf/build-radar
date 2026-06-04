"""Prompt templates for BuildRadar AI analysis."""

OPPORTUNITY_ANALYSIS_PROMPT = """
Ти — AI-аналітик будівельної галузі для платформи BuildRadar.

Тебе надано дані про будівельний об'єкт з України.
Твоє завдання: проаналізувати об'єкт і визначити бізнес-можливості для:
1. HVAC компаній (кондиціонування, вентиляція, опалення)
2. ІТП виробників (індивідуальні теплові пункти)
3. Інженерних компаній
4. Будівельних постачальників

## Дані про об'єкт:
{object_data}

## Потрібно повернути JSON відповідь з такими полями:
{{
    "summary": "стислий опис об'єкту та його значення (2-3 речення)",
    "hvac_opportunity": <число від 0.0 до 1.0 — ймовірність потреби в HVAC системах>,
    "itp_opportunity": <число від 0.0 до 1.0 — ймовірність потреби в ІТП>,
    "engineering_complexity": "<low|medium|high|very_high>",
    "estimated_budget_uah": <приблизний бюджет в гривнях або null>,
    "opportunity_insights": [
        "конкретна інсайтна думка 1",
        "конкретна інсайтна думка 2"
    ],
    "recommended_actions": [
        "конкретна дія для отримання клієнта 1",
        "конкретна дія для отримання клієнта 2"
    ],
    "score": <загальний рейтинг можливості від 0.0 до 1.0>
}}

## Правила оцінки HVAC:
- Висотні будівлі (>10 поверхів): HVAC > 0.85
- ТРЦ, офіси: HVAC > 0.90
- Промислові об'єкти: HVAC 0.70-0.90
- Житлові комплекси (>100 квартир): HVAC 0.60-0.80
- ІТП: актуально для великих житлових та промислових об'єктів з власними тепловими вузлами

Відповідай ЛИШЕ JSON, без пояснень.
"""

NL_SEARCH_PROMPT = """
Ти — помічник для пошуку будівельних об'єктів в Україні.

Тобі надано запит користувача. Перетвори його на JSON-фільтри для пошуку.

## Допустимі значення:
- status: planned, approved, under_construction, completed, suspended, cancelled
- category: residential, commercial, industrial, infrastructure, social, mixed
- object_type: apartment_building, private_house, office, shopping_center, warehouse, factory, hospital, school, hotel, infrastructure, other

## Запит:
{query}

## Поверни JSON:
{{
    "city": [<назви міст або null>],
    "oblast": [<назви областей або null>],
    "status": [<значення зі списку або null>],
    "category": [<значення зі списку або null>],
    "object_type": [<значення зі списку або null>],
    "min_floors": <ціле число або null>,
    "max_floors": <ціле число або null>,
    "min_area": <число або null>,
    "max_area": <число або null>,
    "has_tenders": <true/false або null>,
    "has_permits": <true/false або null>,
    "search": "<ключові слова для текстового пошуку або null>",
    "intent_summary": "<коротко що шукає користувач, 1 речення>"
}}

Правила:
- Якщо поле не згадується — поверни null
- Масиви без значень поверни як null, не як []
- Міста: нормалізуй назви (Київ, Харків, Одеса, Львів, Дніпро, Запоріжжя тощо)
- "будується" / "будівництво" → status: ["under_construction"]
- "завершені" / "здані" → status: ["completed"]
- "ЖК" / "житловий" → category: ["residential"]
- "ТРЦ" / "торговий" → category: ["commercial"], object_type: ["shopping_center"]
- "офіс" → category: ["commercial"], object_type: ["office"]
- "завод" / "фабрика" → category: ["industrial"]
- "школа" / "лікарня" → category: ["social"]

Відповідай ЛИШЕ JSON.
"""

COMPANY_ENRICH_PROMPT = """
Ти — AI-асистент платформи BuildRadar для збагачення даних про українські будівельні компанії.

На основі своїх знань про публічні реєстри (ЄДРПОУ, Prozorro, ЗМІ, відкриті бази даних) — надай відому тобі інформацію про компанію.

## Компанія:
Назва: {name}
{edrpou_line}

## Поверни JSON ЛИШЕ з полями, в яких впевнений (null — якщо не знаєш):
{{
    "edrpou": "<8-значний код ЄДРПОУ або null>",
    "type": "<developer|general_contractor|subcontractor|designer|engineering|technical_supervision|architect|investor або null>",
    "address": "<юридична адреса або null>",
    "phone": "<телефон або null>",
    "email": "<email або null>",
    "website": "<сайт або null>",
    "description": "<2-3 речення: рід діяльності, спеціалізація, відомі проекти або null>",
    "confidence": "<high — точно відома компанія | medium — часткова інформація | low — мало відомостей>",
    "note": "<важлива примітка для перевірки або null>"
}}

ВАЖЛИВО: не вигадуй дані. Якщо компанія невідома — поверни низький confidence і description з загальним описом типу компанії.
Відповідай ЛИШЕ JSON.
"""

OBJECT_ENRICH_PROMPT = """
Ти — AI-асистент платформи BuildRadar для збагачення даних про українські будівельні об'єкти.

На основі своїх знань про публічні реєстри (ЄДЕССБ, Prozorro, ЗМІ, містобудівні документи) — надай відому тобі інформацію про об'єкт.

## Об'єкт:
Назва: {name}
{address_line}
{city_line}

## Поверни JSON ЛИШЕ з полями, в яких впевнений (null — якщо не знаєш):
{{
    "address": "<повна адреса або null>",
    "city": "<місто або null>",
    "oblast": "<область (повна назва, напр. 'Київська') або null>",
    "district": "<район або null>",
    "status": "<planned|approved|under_construction|completed|suspended|cancelled або null>",
    "category": "<residential|commercial|industrial|infrastructure|social|mixed або null>",
    "object_type": "<apartment_building|private_house|office|shopping_center|warehouse|factory|hospital|school|hotel|infrastructure|other або null>",
    "floors": <ціле число або null>,
    "building_area": <площа в м² або null>,
    "land_area": <площа ділянки в м² або null>,
    "construction_stage": "<стадія будівництва або null>",
    "description": "<2-4 речення: опис, призначення, особливості або null>",
    "lat": <широта або null>,
    "lng": <довгота або null>,
    "confidence": "<high — точно відомий об'єкт | medium — часткова інформація | low — мало відомостей>",
    "note": "<важлива примітка або null>"
}}

ВАЖЛИВО: не вигадуй координати чи адреси. Якщо об'єкт невідомий — поверни low confidence і помоги заповнити лише поля, які можна визначити з назви.
Відповідай ЛИШЕ JSON.
"""

WEB_ENRICH_COMPANY_PROMPT = """
Ти — AI-асистент BuildRadar. Ти отримав вміст офіційного сайту будівельної компанії.
Витягни всі доступні дані для заповнення картки компанії.

## Компанія:
Назва: {name}

## URL сайту:
{url}

## Вміст сторінки (перші 5000 символів):
{text}

## Знайдені зображення на сайті:
{images}

## Поверни JSON з полями, які вдалося знайти (null — якщо не знайдено):
{{
    "website": "{url}",
    "phone": "<телефон або null>",
    "email": "<email або null>",
    "address": "<адреса або null>",
    "description": "<2-4 речення про компанію, її спеціалізацію та проекти або null>",
    "type": "<developer|general_contractor|subcontractor|designer|engineering|technical_supervision|architect|investor або null>",
    "edrpou": "<ЄДРПОУ якщо є на сайті або null>",
    "photos": [<список URL зображень, що є фото об'єктів або офісу компанії, max 8>],
    "logo_url": "<URL логотипу компанії або null>",
    "confidence": "<high|medium|low>"
}}

Правила відбору фото:
- Включай лише реальні фото: будівлі, проекти, офіс, команда
- Виключай: іконки, кнопки, банери з текстом, логотипи партнерів
- Повертай абсолютні URL

Відповідай ЛИШЕ JSON.
"""

WEB_ENRICH_OBJECT_PROMPT = """
Ти — AI-асистент BuildRadar. Ти отримав вміст офіційного сайту будівельного об'єкту або ЖК.
Витягни всі доступні дані для заповнення картки об'єкту.

## Об'єкт:
Назва: {name}

## URL сайту:
{url}

## Вміст сторінки (перші 5000 символів):
{text}

## Знайдені зображення на сайті:
{images}

## Поверни JSON з полями, які вдалося знайти (null — якщо не знайдено):
{{
    "website": "{url}",
    "address": "<вулиця, будинок або null>",
    "city": "<місто або null>",
    "oblast": "<область або null>",
    "status": "<planned|approved|under_construction|completed|suspended|cancelled або null>",
    "category": "<residential|commercial|industrial|infrastructure|social|mixed або null>",
    "object_type": "<apartment_building|private_house|office|shopping_center|warehouse|factory|hospital|school|hotel|infrastructure|other або null>",
    "floors": <кількість поверхів або null>,
    "building_area": <площа м² або null>,
    "description": "<2-4 речення: призначення, особливості, стан будівництва або null>",
    "customer": "<замовник або забудовник або null>",
    "general_contractor": "<генпідрядник або null>",
    "designer": "<проектувальник або null>",
    "planned_completion": "<дата завершення YYYY-MM-DD або null>",
    "phone": "<телефон відділу продажів або null>",
    "photos": [<список URL фотографій об'єкту з сайту, max 10>],
    "confidence": "<high|medium|low>"
}}

Правила відбору фото:
- Включай фото будівлі, рендери, фото будівництва, готові інтер'єри
- Виключай: іконки, логотипи, банери з текстом, схеми квартир (маленькі плани)
- Повертай абсолютні URL зображень

Відповідай ЛИШЕ JSON.
"""

COMPANY_ANALYSIS_PROMPT = """
Ти — AI-аналітик будівельної галузі України.
Проаналізуй компанію та визначити її значущість і репутацію.

## Дані про компанію:
{company_data}

Повернути JSON:
{{
    "summary": "опис компанії та її ролі на ринку",
    "market_significance": <0.0-1.0>,
    "reliability_score": <0.0-1.0>,
    "activity_trend": "<growing|stable|declining>",
    "key_strengths": ["сильна сторона 1", "сильна сторона 2"],
    "risks": ["ризик 1"],
    "recommended_contact_strategy": "як краще вийти на цю компанію"
}}

Відповідай ЛИШЕ JSON.
"""
