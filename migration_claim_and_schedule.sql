-- Feature 0: Family Settings
CREATE TABLE IF NOT EXISTS family_settings (
    family_id UUID PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    claim_max_days INTEGER DEFAULT 2,
    claim_points_percent INTEGER DEFAULT 50,
    schedule_enabled BOOLEAN DEFAULT TRUE,
    schedule_register_days TEXT DEFAULT '6,7',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature 1: Claim
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS is_claim BOOLEAN DEFAULT FALSE;
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS claim_reason TEXT;

-- Feature 2: Weekly Schedule
CREATE TABLE IF NOT EXISTS weekly_schedules (
    id BIGSERIAL PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    username TEXT REFERENCES users(username) ON DELETE CASCADE,
    assigned_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(task_id, assigned_date)
);
