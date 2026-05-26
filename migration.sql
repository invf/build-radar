BEGIN;

CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 001_initial_schema

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ENUMs (created once)
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer');

CREATE TYPE object_status AS ENUM (
    'planned', 'approved', 'under_construction',
    'completed', 'suspended', 'cancelled'
);

CREATE TYPE object_category AS ENUM (
    'residential', 'commercial', 'industrial',
    'infrastructure', 'social', 'mixed'
);

CREATE TYPE object_type AS ENUM (
    'apartment_building', 'private_house', 'office',
    'shopping_center', 'warehouse', 'factory',
    'hospital', 'school', 'hotel', 'infrastructure', 'other'
);

CREATE TYPE company_role AS ENUM (
    'developer', 'general_contractor', 'subcontractor',
    'designer', 'engineering', 'technical_supervision',
    'architect', 'investor'
);

CREATE TYPE permit_type AS ENUM (
    'construction_permit', 'readiness_declaration',
    'urban_planning_conditions', 'technical_conditions',
    'design_approval', 'expert_examination'
);

CREATE TYPE tender_status AS ENUM (
    'active', 'complete', 'cancelled', 'unsuccessful'
);

CREATE TYPE note_status AS ENUM (
    'interesting', 'contact_later', 'active_lead',
    'in_progress', 'not_relevant'
);

CREATE TYPE notification_type AS ENUM (
    'new_object', 'status_change', 'new_permit',
    'new_tender', 'ai_insight', 'reminder', 'system'
);

CREATE TYPE parser_status AS ENUM (
    'running', 'completed', 'failed', 'scheduled'
);

-- Tables

CREATE TABLE users (
    id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'viewer' NOT NULL,
    is_active BOOLEAN DEFAULT 'true' NOT NULL,
    invited_by UUID,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_login TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id),
    UNIQUE (email),
    FOREIGN KEY(invited_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_users_email ON users (email);

CREATE TABLE invitations (
    id UUID NOT NULL,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    invited_by UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (token),
    FOREIGN KEY(invited_by) REFERENCES users (id)
);

CREATE INDEX ix_invitations_token ON invitations (token);

CREATE TABLE construction_objects (
    id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    address VARCHAR(500),
    city VARCHAR(100),
    oblast VARCHAR(100),
    district VARCHAR(100),
    coordinates geometry(POINT,4326),
    status object_status DEFAULT 'planned' NOT NULL,
    category object_category,
    object_type object_type,
    floors INTEGER,
    building_area FLOAT,
    land_area FLOAT,
    construction_stage VARCHAR(255),
    planned_completion TIMESTAMP WITH TIME ZONE,
    description TEXT,
    photos TEXT[],
    source VARCHAR(100) NOT NULL,
    source_id VARCHAR(255),
    raw_data JSONB,
    ai_score FLOAT,
    ai_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE INDEX idx_construction_objects_coordinates ON construction_objects USING gist (coordinates);
CREATE INDEX ix_construction_objects_name ON construction_objects (name);
CREATE INDEX ix_construction_objects_city ON construction_objects (city);
CREATE INDEX ix_construction_objects_oblast ON construction_objects (oblast);
CREATE INDEX ix_construction_objects_status ON construction_objects (status);
CREATE INDEX ix_construction_objects_category ON construction_objects (category);
CREATE INDEX ix_construction_objects_ai_score ON construction_objects (ai_score);
CREATE INDEX ix_construction_objects_source ON construction_objects (source);
CREATE INDEX ix_construction_objects_source_id ON construction_objects (source_id);
CREATE INDEX ix_construction_objects_fts ON construction_objects
    USING gin(to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(address,'') || ' ' || coalesce(city,'')));

CREATE TABLE companies (
    id UUID NOT NULL,
    name VARCHAR(500) NOT NULL,
    edrpou VARCHAR(20),
    type company_role,
    address VARCHAR(500),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    description TEXT,
    ai_score FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (edrpou)
);

CREATE INDEX ix_companies_name ON companies (name);
CREATE INDEX ix_companies_edrpou ON companies (edrpou);

CREATE TABLE object_companies (
    id UUID NOT NULL,
    object_id UUID NOT NULL,
    company_id UUID NOT NULL,
    role company_role NOT NULL,
    is_primary BOOLEAN DEFAULT 'false',
    PRIMARY KEY (id),
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE CASCADE,
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX ix_object_companies_object_id ON object_companies (object_id);
CREATE INDEX ix_object_companies_company_id ON object_companies (company_id);

CREATE TABLE permits (
    id UUID NOT NULL,
    object_id UUID NOT NULL,
    permit_number VARCHAR(255) NOT NULL,
    permit_type permit_type NOT NULL,
    series VARCHAR(20),
    issued_date TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    issuing_authority VARCHAR(500),
    document_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE CASCADE
);

CREATE INDEX ix_permits_object_id ON permits (object_id);
CREATE INDEX ix_permits_permit_number ON permits (permit_number);

CREATE TABLE tenders (
    id UUID NOT NULL,
    object_id UUID,
    prozorro_id VARCHAR(255) NOT NULL,
    title TEXT NOT NULL,
    status tender_status DEFAULT 'active' NOT NULL,
    amount FLOAT,
    currency VARCHAR(10) DEFAULT 'UAH',
    deadline TIMESTAMP WITH TIME ZONE,
    procuring_entity VARCHAR(500),
    procuring_entity_edrpou VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE SET NULL,
    UNIQUE (prozorro_id)
);

CREATE INDEX ix_tenders_object_id ON tenders (object_id);
CREATE INDEX ix_tenders_prozorro_id ON tenders (prozorro_id);
CREATE INDEX ix_tenders_procuring_entity_edrpou ON tenders (procuring_entity_edrpou);

CREATE TABLE object_notes (
    id UUID NOT NULL,
    object_id UUID NOT NULL,
    user_id UUID NOT NULL,
    note_text TEXT NOT NULL,
    status note_status,
    tags VARCHAR(100)[],
    reminder_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_object_notes_object_id ON object_notes (object_id);
CREATE INDEX ix_object_notes_user_id ON object_notes (user_id);

CREATE TABLE saved_searches (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    filters JSONB DEFAULT '{}' NOT NULL,
    notify_enabled BOOLEAN DEFAULT 'false',
    last_checked TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_saved_searches_user_id ON saved_searches (user_id);

CREATE TABLE favorite_objects (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    object_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE CASCADE
);

CREATE INDEX ix_favorite_objects_user_id ON favorite_objects (user_id);
CREATE INDEX ix_favorite_objects_object_id ON favorite_objects (object_id);

CREATE TABLE favorite_companies (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY(company_id) REFERENCES companies (id) ON DELETE CASCADE
);

CREATE INDEX ix_favorite_companies_user_id ON favorite_companies (user_id);
CREATE INDEX ix_favorite_companies_company_id ON favorite_companies (company_id);

CREATE TABLE ai_analyses (
    id UUID NOT NULL,
    object_id UUID NOT NULL,
    analysis_type VARCHAR(100) DEFAULT 'opportunity_analysis',
    summary TEXT,
    hvac_opportunity FLOAT,
    itp_opportunity FLOAT,
    engineering_complexity VARCHAR(20),
    estimated_budget_uah FLOAT,
    opportunity_insights JSONB,
    recommended_actions JSONB,
    content JSONB,
    score FLOAT,
    model_version VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE CASCADE
);

CREATE INDEX ix_ai_analyses_object_id ON ai_analyses (object_id);
CREATE INDEX ix_ai_analyses_score ON ai_analyses (score);

CREATE TABLE status_history (
    id UUID NOT NULL,
    object_id UUID NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    source VARCHAR(100) NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(object_id) REFERENCES construction_objects (id) ON DELETE CASCADE
);

CREATE INDEX ix_status_history_object_id ON status_history (object_id);

CREATE TABLE notifications (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    type notification_type,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 'false',
    related_object_id UUID,
    related_company_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notifications_user_id ON notifications (user_id);
CREATE INDEX ix_notifications_is_read ON notifications (is_read);

CREATE TABLE notification_settings (
    user_id UUID NOT NULL,
    email_enabled BOOLEAN DEFAULT 'true',
    telegram_enabled BOOLEAN DEFAULT 'false',
    push_enabled BOOLEAN DEFAULT 'true',
    telegram_chat_id VARCHAR(100),
    digest_frequency VARCHAR(20) DEFAULT 'daily',
    PRIMARY KEY (user_id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE parser_logs (
    id UUID NOT NULL,
    source VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    objects_found INTEGER DEFAULT '0',
    objects_updated INTEGER DEFAULT '0',
    objects_created INTEGER DEFAULT '0',
    errors JSONB,
    status parser_status DEFAULT 'running' NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX ix_parser_logs_source ON parser_logs (source);
CREATE INDEX ix_parser_logs_status ON parser_logs (status);

CREATE TABLE audit_logs (
    id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    metadata JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX ix_audit_logs_action ON audit_logs (action);

-- Row Level Security
ALTER TABLE object_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO alembic_version (version_num) VALUES ('001_initial_schema');

COMMIT;
