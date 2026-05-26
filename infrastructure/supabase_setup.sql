-- ============================================================
-- BuildRadar — Complete Database Schema for Supabase
-- Run this ONCE in Supabase SQL Editor (Project → SQL Editor)
-- This is self-contained: extensions → enums → tables → indexes → RLS → views
-- ============================================================

-- ─── 1. Extensions ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS postgis;      -- Geospatial support
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- Fuzzy text search
CREATE EXTENSION IF NOT EXISTS unaccent;     -- Ukrainian text normalization
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- uuid_generate_v4()

-- ─── 2. Enum Types ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE object_status AS ENUM (
    'planned', 'approved', 'under_construction', 'completed', 'suspended', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE object_category AS ENUM (
    'residential', 'commercial', 'industrial', 'infrastructure', 'social', 'mixed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE object_type AS ENUM (
    'apartment_building', 'private_house', 'office', 'shopping_center',
    'warehouse', 'factory', 'hospital', 'school', 'hotel', 'infrastructure', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE company_role AS ENUM (
    'developer', 'general_contractor', 'subcontractor', 'designer',
    'engineering', 'technical_supervision', 'architect', 'investor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE permit_type AS ENUM (
    'construction_permit', 'readiness_declaration', 'urban_planning_conditions',
    'technical_conditions', 'design_approval', 'expert_examination'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tender_status AS ENUM ('active', 'complete', 'cancelled', 'unsuccessful');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE note_status AS ENUM (
    'interesting', 'contact_later', 'active_lead', 'in_progress', 'not_relevant'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'new_object', 'status_change', 'new_permit', 'new_tender',
    'ai_insight', 'reminder', 'system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parser_status AS ENUM ('running', 'completed', 'failed', 'scheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Core Tables ───────────────────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  role            user_role NOT NULL DEFAULT 'viewer',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  invited_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  role        user_role NOT NULL DEFAULT 'viewer',
  invited_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

-- Construction Objects (main data table)
CREATE TABLE IF NOT EXISTS construction_objects (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 TEXT NOT NULL,
  address              TEXT,
  city                 TEXT,
  oblast               TEXT,
  district             TEXT,
  coordinates          GEOMETRY(Point, 4326),  -- PostGIS WGS84 point
  status               object_status NOT NULL DEFAULT 'planned',
  category             object_category,
  object_type          object_type,
  floors               INTEGER,
  building_area        FLOAT,
  land_area            FLOAT,
  construction_stage   TEXT,
  planned_completion   TIMESTAMPTZ,
  description          TEXT,
  photos               TEXT[],
  source               TEXT NOT NULL,          -- 'edesb', 'prozorro', etc.
  source_id            TEXT,                   -- original ID in source system
  raw_data             JSONB,
  ai_score             FLOAT,
  ai_summary           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_co_city      ON construction_objects(city);
CREATE INDEX IF NOT EXISTS idx_co_oblast    ON construction_objects(oblast);
CREATE INDEX IF NOT EXISTS idx_co_status    ON construction_objects(status);
CREATE INDEX IF NOT EXISTS idx_co_category  ON construction_objects(category);
CREATE INDEX IF NOT EXISTS idx_co_ai_score  ON construction_objects(ai_score);
CREATE INDEX IF NOT EXISTS idx_co_source    ON construction_objects(source, source_id);
CREATE INDEX IF NOT EXISTS idx_co_geom      ON construction_objects USING GIST(coordinates);
CREATE INDEX IF NOT EXISTS idx_co_updated   ON construction_objects(updated_at DESC);
-- GIN index for trigram search (fast ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_co_name_trgm    ON construction_objects USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_co_address_trgm ON construction_objects USING GIN(address gin_trgm_ops);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_co_updated_at ON construction_objects;
CREATE TRIGGER trg_co_updated_at
  BEFORE UPDATE ON construction_objects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  edrpou      TEXT UNIQUE,
  type        company_role,
  address     TEXT,
  phone       TEXT,
  email       TEXT,
  website     TEXT,
  description TEXT,
  ai_score    FLOAT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companies_edrpou ON companies(edrpou);
CREATE INDEX IF NOT EXISTS idx_companies_name   ON companies USING GIN(name gin_trgm_ops);

-- Object ↔ Company junction
CREATE TABLE IF NOT EXISTS object_companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id   UUID NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role        company_role NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(object_id, company_id, role)
);
CREATE INDEX IF NOT EXISTS idx_oc_object_id  ON object_companies(object_id);
CREATE INDEX IF NOT EXISTS idx_oc_company_id ON object_companies(company_id);

-- Permits
CREATE TABLE IF NOT EXISTS permits (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id          UUID NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
  permit_number      TEXT NOT NULL,
  permit_type        permit_type NOT NULL,
  series             TEXT,
  issued_date        TIMESTAMPTZ,
  valid_until        TIMESTAMPTZ,
  issuing_authority  TEXT,
  document_url       TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_permits_object_id     ON permits(object_id);
CREATE INDEX IF NOT EXISTS idx_permits_permit_number ON permits(permit_number);

-- Tenders (Prozorro)
CREATE TABLE IF NOT EXISTS tenders (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id                UUID REFERENCES construction_objects(id) ON DELETE SET NULL,
  prozorro_id              TEXT UNIQUE NOT NULL,
  title                    TEXT NOT NULL,
  status                   tender_status NOT NULL DEFAULT 'active',
  amount                   FLOAT,
  currency                 TEXT DEFAULT 'UAH',
  deadline                 TIMESTAMPTZ,
  procuring_entity         TEXT,
  procuring_entity_edrpou  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenders_object_id  ON tenders(object_id);
CREATE INDEX IF NOT EXISTS idx_tenders_prozorro   ON tenders(prozorro_id);
CREATE INDEX IF NOT EXISTS idx_tenders_status     ON tenders(status);

-- ─── 4. User-Specific Tables ──────────────────────────────────────────────────

-- Private notes per user per object
CREATE TABLE IF NOT EXISTS object_notes (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id      UUID NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_text      TEXT NOT NULL,
  status         note_status,
  tags           TEXT[],
  reminder_date  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(object_id, user_id)   -- one note per user per object
);
CREATE INDEX IF NOT EXISTS idx_notes_user_id   ON object_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_object_id ON object_notes(object_id);
CREATE INDEX IF NOT EXISTS idx_notes_reminder  ON object_notes(reminder_date) WHERE reminder_date IS NOT NULL;

DROP TRIGGER IF EXISTS trg_notes_updated_at ON object_notes;
CREATE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON object_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Saved searches (with notification support)
CREATE TABLE IF NOT EXISTS saved_searches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  filters         JSONB NOT NULL DEFAULT '{}',
  notify_enabled  BOOLEAN NOT NULL DEFAULT false,
  last_checked    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);

-- Favorite objects
CREATE TABLE IF NOT EXISTS favorite_objects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_id   UUID NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, object_id)
);
CREATE INDEX IF NOT EXISTS idx_fav_objects_user ON favorite_objects(user_id);

-- Favorite companies
CREATE TABLE IF NOT EXISTS favorite_companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
CREATE INDEX IF NOT EXISTS idx_fav_companies_user ON favorite_companies(user_id);

-- ─── 5. Intelligence Tables ───────────────────────────────────────────────────

-- AI analysis results
CREATE TABLE IF NOT EXISTS ai_analyses (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id               UUID NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
  analysis_type           TEXT NOT NULL DEFAULT 'opportunity_analysis',
  summary                 TEXT,
  hvac_opportunity        FLOAT,
  itp_opportunity         FLOAT,
  engineering_complexity  TEXT,
  estimated_budget_uah    FLOAT,
  opportunity_insights    JSONB,
  recommended_actions     JSONB,
  content                 JSONB,
  score                   FLOAT,
  model_version           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_object_id ON ai_analyses(object_id);
CREATE INDEX IF NOT EXISTS idx_ai_score     ON ai_analyses(score DESC);

-- Status change history
CREATE TABLE IF NOT EXISTS status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id   UUID NOT NULL REFERENCES construction_objects(id) ON DELETE CASCADE,
  field_name  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  source      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_object_id ON status_history(object_id);

-- ─── 6. Notification Tables ───────────────────────────────────────────────────

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                notification_type NOT NULL,
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  is_read             BOOLEAN NOT NULL DEFAULT false,
  related_object_id   UUID,
  related_company_id  UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user_id  ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_is_read  ON notifications(user_id, is_read);

-- Notification settings per user
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled     BOOLEAN NOT NULL DEFAULT true,
  telegram_enabled  BOOLEAN NOT NULL DEFAULT false,
  push_enabled      BOOLEAN NOT NULL DEFAULT true,
  telegram_chat_id  TEXT,
  digest_frequency  TEXT NOT NULL DEFAULT 'daily'
);

-- ─── 7. System Tables ─────────────────────────────────────────────────────────

-- Parser run logs
CREATE TABLE IF NOT EXISTS parser_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source           TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  objects_found    INTEGER NOT NULL DEFAULT 0,
  objects_updated  INTEGER NOT NULL DEFAULT 0,
  objects_created  INTEGER NOT NULL DEFAULT 0,
  errors           JSONB,
  status           parser_status NOT NULL DEFAULT 'running'
);
CREATE INDEX IF NOT EXISTS idx_parser_logs_source ON parser_logs(source);
CREATE INDEX IF NOT EXISTS idx_parser_logs_status ON parser_logs(status);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  resource_type  TEXT,
  resource_id    TEXT,
  metadata       JSONB,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON audit_logs(created_at DESC);

-- ─── 8. Row Level Security ────────────────────────────────────────────────────

ALTER TABLE object_notes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_objects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- object_notes policies
DROP POLICY IF EXISTS "notes_select_own"  ON object_notes;
DROP POLICY IF EXISTS "notes_insert_own"  ON object_notes;
DROP POLICY IF EXISTS "notes_update_own"  ON object_notes;
DROP POLICY IF EXISTS "notes_delete_own"  ON object_notes;
DROP POLICY IF EXISTS "notes_admin_all"   ON object_notes;

CREATE POLICY "notes_select_own" ON object_notes
  FOR SELECT USING (user_id = auth.uid()::uuid);
CREATE POLICY "notes_insert_own" ON object_notes
  FOR INSERT WITH CHECK (user_id = auth.uid()::uuid);
CREATE POLICY "notes_update_own" ON object_notes
  FOR UPDATE USING (user_id = auth.uid()::uuid);
CREATE POLICY "notes_delete_own" ON object_notes
  FOR DELETE USING (user_id = auth.uid()::uuid);
CREATE POLICY "notes_admin_all" ON object_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::uuid AND role = 'admin')
  );

-- saved_searches policies
DROP POLICY IF EXISTS "searches_own" ON saved_searches;
CREATE POLICY "searches_own" ON saved_searches
  FOR ALL USING (user_id = auth.uid()::uuid);

-- favorite_objects policies
DROP POLICY IF EXISTS "fav_objects_own" ON favorite_objects;
CREATE POLICY "fav_objects_own" ON favorite_objects
  FOR ALL USING (user_id = auth.uid()::uuid);

-- favorite_companies policies
DROP POLICY IF EXISTS "fav_companies_own" ON favorite_companies;
CREATE POLICY "fav_companies_own" ON favorite_companies
  FOR ALL USING (user_id = auth.uid()::uuid);

-- notifications policies
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid()::uuid);
CREATE POLICY "notif_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid()::uuid);

-- notification_settings policies
DROP POLICY IF EXISTS "notif_settings_own" ON notification_settings;
CREATE POLICY "notif_settings_own" ON notification_settings
  FOR ALL USING (user_id = auth.uid()::uuid);

-- ─── 9. Analytics Views ───────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_objects_by_city AS
SELECT city, oblast, count(*) AS total
FROM construction_objects
WHERE city IS NOT NULL
GROUP BY city, oblast
ORDER BY total DESC;

CREATE OR REPLACE VIEW v_active_tenders AS
SELECT t.*, co.name AS object_name, co.city
FROM tenders t
LEFT JOIN construction_objects co ON co.id = t.object_id
WHERE t.status = 'active'
ORDER BY t.created_at DESC;

CREATE OR REPLACE VIEW v_top_developers AS
SELECT c.id, c.name, c.edrpou, count(oc.object_id) AS objects_count
FROM companies c
JOIN object_companies oc ON oc.company_id = c.id AND oc.role = 'developer'
GROUP BY c.id, c.name, c.edrpou
ORDER BY objects_count DESC;

-- ─── 10. Utility Functions ────────────────────────────────────────────────────

-- Find objects within radius (used by map radius search)
CREATE OR REPLACE FUNCTION objects_within_radius(
  center_lat FLOAT,
  center_lng FLOAT,
  radius_km  FLOAT
) RETURNS TABLE (
  id          UUID,
  name        TEXT,
  city        TEXT,
  status      TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.id,
    co.name,
    co.city,
    co.status::TEXT,
    ROUND((ST_Distance(
      co.coordinates::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography
    ) / 1000.0)::NUMERIC, 2)::FLOAT AS distance_km
  FROM construction_objects co
  WHERE co.coordinates IS NOT NULL
    AND ST_DWithin(
      co.coordinates::geography,
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql STABLE;

-- Full-text search helper (Ukrainian tokenization)
CREATE OR REPLACE FUNCTION search_objects(query TEXT)
RETURNS TABLE (id UUID, name TEXT, city TEXT, status TEXT, rank FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    co.id,
    co.name,
    co.city,
    co.status::TEXT,
    ts_rank(
      to_tsvector('simple', coalesce(co.name,'') || ' ' || coalesce(co.address,'') || ' ' || coalesce(co.city,'')),
      plainto_tsquery('simple', query)
    )::FLOAT AS rank
  FROM construction_objects co
  WHERE
    to_tsvector('simple', coalesce(co.name,'') || ' ' || coalesce(co.address,'') || ' ' || coalesce(co.city,''))
    @@ plainto_tsquery('simple', query)
    OR co.name ILIKE '%' || query || '%'
    OR co.address ILIKE '%' || query || '%'
  ORDER BY rank DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── 11. Auth Sync Trigger ────────────────────────────────────────────────────
-- When a user signs up via Supabase Auth, auto-create their profile in public.users
-- using the SAME UUID so JWT sub → User.id lookup works correctly.

CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_active, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer',
    true,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ─── Done ─────────────────────────────────────────────────────────────────────
-- Schema created successfully.
--
-- FIRST ADMIN SETUP:
-- 1. Create your admin account via Supabase Auth (Dashboard → Authentication → Users → Add user)
-- 2. Copy the user UUID from the list
-- 3. Run:
--    UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
--
-- Or if you want to create the admin user and set role in one step after signing up:
--    UPDATE users SET role = 'admin', full_name = 'Admin Name' WHERE email = 'your@email.com';
