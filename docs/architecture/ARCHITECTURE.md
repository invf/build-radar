# BuildRadar — Enterprise Architecture Document

## Platform Overview

BuildRadar is a private, invite-only SaaS platform for monitoring construction
intelligence across Ukraine. It aggregates open-data sources, applies AI analytics,
and delivers actionable business leads to HVAC companies, ITP manufacturers,
engineering firms, and construction suppliers.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│   Browser (Next.js SPA)  │  Mobile (PWA)  │  API Consumers          │
└─────────────┬───────────────────┬──────────────────┬───────────────-┘
              │                   │                  │
              ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        VERCEL CDN / EDGE                             │
│   Next.js 15 App Router  │  API Routes  │  Image Optimization        │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │ HTTPS / WebSocket
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FASTAPI BACKEND (Render/Railway)                 │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Auth Layer  │  │  REST API v1 │  │   WebSocket Gateway      │   │
│  │  JWT + RLS   │  │  OpenAPI     │  │   Real-time Updates      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  Services    │  │  AI Module   │  │   Parser Engine          │   │
│  │  Layer       │  │  OpenAI/     │  │   Multi-source           │   │
│  │              │  │  Claude      │  │   Connectors             │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└───────────────────┬──────────────────────────────┬──────────────────┘
                    │                              │
          ┌─────────▼──────────┐      ┌───────────▼────────────┐
          │   PostgreSQL        │      │   Redis Cache          │
          │   (Supabase)        │      │   + Celery Broker      │
          │   + PostGIS         │      │                        │
          └─────────────────────┘      └────────────────────────┘
                    │
          ┌─────────▼──────────┐
          │   Celery Workers    │
          │   Background Jobs   │
          │   - Parser tasks    │
          │   - AI analysis     │
          │   - Notifications   │
          └─────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 ЄДЕССБ        Prozorro       data.gov.ua
 Parser        Parser         Parser
     │              │              │
     └──────────────┴──────────────┘
            External APIs
```

---

## Component Architecture

### Frontend (Next.js 15 App Router)

```
src/
├── app/
│   ├── (auth)/                   # Auth route group (public)
│   │   ├── login/
│   │   ├── forgot-password/
│   │   └── invite/[token]/
│   ├── (dashboard)/              # Protected route group
│   │   ├── layout.tsx            # Dashboard shell with sidebar
│   │   ├── page.tsx              # Main dashboard
│   │   ├── objects/              # Construction objects
│   │   │   ├── page.tsx          # Objects list + map
│   │   │   └── [id]/             # Object detail
│   │   ├── map/                  # Full map view
│   │   ├── companies/            # Companies directory
│   │   ├── permits/              # Permits browser
│   │   ├── tenders/              # Tenders (Prozorro)
│   │   ├── analytics/            # Analytics dashboards
│   │   ├── search/               # Advanced search
│   │   ├── alerts/               # Notifications center
│   │   └── settings/             # User settings & profile
│   ├── admin/                    # Admin panel (admin role)
│   │   ├── users/
│   │   ├── parsers/
│   │   ├── logs/
│   │   └── system/
│   └── api/                      # Next.js API routes (proxy/auth)
├── components/
│   ├── ui/                       # ShadCN primitives
│   ├── layout/                   # Shell, sidebar, navbar
│   ├── dashboard/                # Dashboard widgets
│   ├── map/                      # Leaflet components
│   ├── objects/                  # Construction object cards, tables
│   ├── companies/                # Company components
│   ├── analytics/                # Chart components (Recharts)
│   ├── search/                   # Search UI
│   └── shared/                   # Common components
├── lib/
│   ├── api/                      # API client (fetch wrappers)
│   ├── auth/                     # Supabase auth helpers
│   └── utils/                    # Formatters, helpers
├── hooks/                        # Custom React hooks
├── stores/                       # Zustand global state
└── types/                        # TypeScript type definitions
```

### Backend (FastAPI)

```
app/
├── api/
│   └── v1/
│       ├── auth.py               # Login, invite, refresh
│       ├── users.py              # User management
│       ├── objects.py            # Construction objects CRUD + search
│       ├── companies.py          # Companies
│       ├── permits.py            # Permits
│       ├── tenders.py            # Tenders
│       ├── notes.py              # User notes on objects
│       ├── saved_searches.py     # Saved searches + alerts
│       ├── favorites.py          # Favorite objects
│       ├── analytics.py          # Analytics aggregations
│       ├── ai.py                 # AI analysis endpoints
│       ├── notifications.py      # Notification management
│       ├── export.py             # Data export (CSV/Excel/PDF)
│       └── admin.py              # Admin endpoints
├── core/
│   ├── config.py                 # Settings (Pydantic BaseSettings)
│   ├── security.py               # JWT, password hashing
│   ├── database.py               # Async SQLAlchemy engine
│   ├── redis.py                  # Redis client
│   └── dependencies.py           # FastAPI dependency injection
├── models/                       # SQLAlchemy ORM models
├── schemas/                      # Pydantic request/response schemas
├── services/                     # Business logic layer
├── parsers/                      # Data source connectors
│   ├── base.py                   # Abstract base parser
│   ├── edesb.py                  # ЄДЕССБ connector
│   ├── econstruction.py          # e-construction.gov.ua
│   ├── prozorro.py               # Prozorro API
│   ├── data_gov.py               # data.gov.ua datasets
│   ├── cadastral.py              # Public cadastral map
│   └── scheduler.py              # Parser scheduling
├── tasks/                        # Celery async tasks
│   ├── celery_app.py
│   ├── parser_tasks.py
│   ├── ai_tasks.py
│   └── notification_tasks.py
├── ai/                           # AI analytics
│   ├── client.py                 # OpenAI + Claude clients
│   ├── analyzers.py              # Project analyzers
│   ├── scoring.py                # Opportunity scoring
│   └── prompts.py                # Prompt templates
└── utils/
    ├── geo.py                    # Geospatial utilities
    ├── pagination.py             # Cursor/offset pagination
    └── search.py                 # Full-text search helpers
```

---

## Database Schema

```sql
-- Users & Auth
users (id, email, full_name, role, is_active, invited_by, created_at, last_login)
invitations (id, email, token, role, invited_by, expires_at, used_at)
user_sessions (id, user_id, refresh_token, expires_at)

-- Core Data
construction_objects (id, name, address, city, oblast, district,
  coordinates GEOMETRY(Point,4326), status, category, object_type,
  floors, building_area, land_area, description, source, source_id,
  ai_score, ai_summary, created_at, updated_at)

companies (id, name, edrpou, type, address, phone, email,
  website, description, ai_score, created_at, updated_at)

object_companies (object_id, company_id, role, is_primary)

permits (id, object_id, permit_number, permit_type, series,
  issued_date, valid_until, issuing_authority, document_url, raw_data)

tenders (id, object_id, prozorro_id, title, status, amount,
  currency, deadline, procuring_entity, created_at, updated_at)

-- User Features
object_notes (id, object_id, user_id, note_text, status,
  tags TEXT[], reminder_date, created_at, updated_at)

saved_searches (id, user_id, name, filters JSONB, notify_enabled,
  last_checked, created_at)

favorite_objects (id, user_id, object_id, created_at)
favorite_companies (id, user_id, company_id, created_at)

-- Analytics & Intelligence
ai_analysis (id, object_id, analysis_type, content JSONB,
  score FLOAT, model_version, created_at)

status_history (id, object_id, field_name, old_value,
  new_value, changed_at, source)

-- Notifications & Logs
notifications (id, user_id, type, title, body, is_read,
  related_object_id, related_company_id, created_at)

notification_settings (user_id, email_enabled, telegram_enabled,
  push_enabled, telegram_chat_id, digest_frequency)

parser_logs (id, source, started_at, completed_at,
  objects_found, objects_updated, objects_created, errors JSONB, status)

audit_logs (id, user_id, action, resource_type, resource_id,
  metadata JSONB, ip_address, created_at)
```

---

## Authentication Flow

```
1. Admin creates invitation (POST /api/v1/auth/invite)
   → Generates secure token, stores in invitations table
   → Sends invitation email with link

2. User registers via invitation link (/invite/[token])
   → Validates token, creates Supabase user
   → Sets role from invitation
   → Marks invitation as used

3. User logs in (POST /api/v1/auth/login)
   → Validates credentials via Supabase Auth
   → Returns JWT access token + refresh token
   → Frontend stores in httpOnly cookie

4. Protected routes
   → Next.js middleware validates token
   → FastAPI dependency validates JWT
   → Row Level Security enforced in Supabase

5. Token refresh
   → Auto-refresh on 401 via interceptor
   → Invalidate on logout
```

---

## Parser Architecture

```
BaseParser (Abstract)
├── fetch() → raw data
├── parse() → normalized ConstructionObject
├── upsert() → database write
├── schedule() → APScheduler cron
└── log() → parser_logs table

Implementations:
├── EdesbParser        → ЄДЕССБ API + scraping
├── EconstructionParser → e-construction.gov.ua REST
├── ProzorroParser     → Prozorro OpenAPI
├── DataGovParser      → data.gov.ua CSV/JSON datasets
└── CadastralParser    → Public cadastral GIS data

Scheduling (Celery Beat):
├── Every 15min → New permits check
├── Every 1hr   → Tender updates
├── Every 6hr   → Full object sync
└── Every 24hr  → AI re-analysis batch
```

---

## AI Analytics Architecture

```
Project submitted for AI analysis
         │
         ▼
   AIAnalyzer.analyze(object_id)
         │
    ┌────┴────────────────────┐
    │  GPT-4o / Claude API    │
    │  Prompt: project data   │
    └────┬────────────────────┘
         │
    ┌────▼──────────────────────────────────────┐
    │  Structured JSON Response                  │
    │  {                                         │
    │    "summary": "...",                       │
    │    "hvac_opportunity": 0.85,               │
    │    "itp_opportunity": 0.72,                │
    │    "engineering_complexity": "high",       │
    │    "estimated_budget_uah": 50000000,       │
    │    "opportunity_insights": ["...", "..."], │
    │    "recommended_actions": ["...", "..."]   │
    │  }                                         │
    └────┬──────────────────────────────────────┘
         │
         ▼
   Store in ai_analysis table
   Update construction_objects.ai_score
```

---

## API Design Principles

- **Versioned**: All endpoints under `/api/v1/`
- **Paginated**: Cursor-based for lists > 1000 items
- **Filterable**: Every list endpoint supports query params
- **Typed**: Full Pydantic schema validation
- **Documented**: Auto Swagger at `/docs`
- **Rate limited**: 100 req/min per user, 1000/min admin
- **Cached**: Redis TTL on hot endpoints (map data, analytics)

---

## Deployment Architecture

```
Production:
├── Frontend → Vercel (automatic from GitHub main)
│   ├── Edge functions for auth middleware
│   └── ISR for public-facing pages
│
├── Backend → Render (Docker container)
│   ├── FastAPI (2 instances min)
│   ├── Celery worker (1-3 instances)
│   └── Celery beat (1 instance)
│
├── Database → Supabase (PostgreSQL + PostGIS)
│   ├── Connection pooling (PgBouncer)
│   └── Read replicas for analytics
│
└── Cache → Redis (Render Redis or Upstash)
    ├── API response cache
    ├── Celery broker
    └── Rate limiting

Environment:
├── .env.local       (Next.js local)
├── .env.production  (Vercel env vars)
└── .env             (FastAPI / Docker)
```

---

## Security Architecture

- **JWT**: RS256 signed tokens, 15min access / 7day refresh
- **Supabase RLS**: Row-level policies on all user data tables
- **RBAC**: admin > manager > viewer permission hierarchy
- **Rate Limiting**: SlowAPI middleware per endpoint
- **CORS**: Strict origin allowlist
- **Secrets**: Environment variables only, never committed
- **Audit Logging**: Every mutating action logged with user + IP
- **HTTPS**: Enforced everywhere, HSTS headers

---

## Performance Strategy

- **PostGIS**: Spatial indexing for all geospatial queries
- **GIN index**: Full-text search on name, address, description
- **Redis cache**: 5min TTL on map cluster data, 1hr on analytics
- **Pagination**: Cursor-based to avoid OFFSET performance issues
- **Connection pooling**: PgBouncer for PostgreSQL
- **Background AI**: Async Celery tasks, never blocking API
- **CDN**: Vercel Edge for static assets and ISR pages

---

## MVP Roadmap

### Phase 1 (Weeks 1-2): Foundation
- [ ] Project scaffold (Next.js + FastAPI)
- [ ] Database schema + migrations
- [ ] Auth (Supabase + JWT)
- [ ] Basic CRUD APIs
- [ ] Core UI shell

### Phase 2 (Weeks 3-4): Core Features
- [ ] Construction objects listing + detail
- [ ] Interactive map (Leaflet)
- [ ] Basic search + filters
- [ ] User notes system
- [ ] Favorites

### Phase 3 (Weeks 5-6): Data Ingestion
- [ ] ЄДЕССБ parser
- [ ] Prozorro parser
- [ ] data.gov.ua parser
- [ ] Celery scheduling
- [ ] Admin parser monitoring

### Phase 4 (Weeks 7-8): Intelligence
- [ ] AI analytics module
- [ ] Opportunity scoring
- [ ] AI summaries on objects
- [ ] Analytics dashboards
- [ ] Export (CSV, Excel)

### Phase 5 (Weeks 9-10): Production
- [ ] Notification system
- [ ] Performance tuning
- [ ] Security audit
- [ ] Deployment automation
- [ ] User onboarding flow
