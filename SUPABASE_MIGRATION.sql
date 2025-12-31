-- ============================================================
-- GARAGE REPAIR MANAGEMENT API - DATABASE MIGRATION
-- ============================================================
-- Copy this entire file and run in Supabase SQL Editor
-- URL: https://rdrlxmpwkkeryfcszltc.supabase.co/project/_/sql/new
-- ============================================================

-- ============================================================
-- STEP 1: ADD REQUIRED COLUMNS
-- ============================================================
-- Adds 3 new columns to the repairs table

ALTER TABLE repairs 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'in_progress',
ADD COLUMN IF NOT EXISTS final_issue_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();


-- ============================================================
-- STEP 2: ADD VALIDATION CONSTRAINTS (RECOMMENDED)
-- ============================================================
-- These prevent invalid data from being inserted
-- You can change these values later by dropping and re-adding

-- Validate status values
ALTER TABLE repairs 
DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE repairs 
ADD CONSTRAINT valid_status 
CHECK (status IN ('in_progress', 'completed', 'on_hold', 'cancelled'));

-- Validate issue type values (allows NULL since it's optional)
ALTER TABLE repairs 
DROP CONSTRAINT IF EXISTS valid_issue_type;

ALTER TABLE repairs 
ADD CONSTRAINT valid_issue_type 
CHECK (final_issue_type IS NULL OR final_issue_type IN (
  'engine',
  'brakes', 
  'electrical',
  'ac',
  'starting',
  'gearbox',
  'noise',
  'suspension',
  'transmission',
  'fuel_system',
  'cooling_system',
  'exhaust',
  'tires',
  'steering',
  'other'
));


-- ============================================================
-- STEP 3: ADD INDEXES (OPTIONAL - FOR PERFORMANCE)
-- ============================================================
-- Only needed when you have 10,000+ repairs
-- Uncomment these lines if filtering gets slow (>1 second)

-- CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
-- CREATE INDEX IF NOT EXISTS idx_repairs_final_issue_type ON repairs(final_issue_type);
-- CREATE INDEX IF NOT EXISTS idx_repairs_garage_id ON repairs(garage_id);
-- CREATE INDEX IF NOT EXISTS idx_repairs_created_at ON repairs(created_at);


-- ============================================================
-- STEP 4: AUTO-UPDATE TRIGGER (OPTIONAL - NICE TO HAVE)
-- ============================================================
-- Automatically updates 'updated_at' timestamp when repair is modified
-- Uncomment if you want this automation

-- CREATE OR REPLACE FUNCTION update_repairs_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     NEW.updated_at = NOW();
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- DROP TRIGGER IF EXISTS trigger_repairs_updated_at ON repairs;

-- CREATE TRIGGER trigger_repairs_updated_at
--     BEFORE UPDATE ON repairs
--     FOR EACH ROW
--     EXECUTE FUNCTION update_repairs_updated_at();


-- ============================================================
-- STEP 5: VERIFY MIGRATION (OPTIONAL - SHOWS RESULTS)
-- ============================================================
-- This just displays the columns to confirm they were added

SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'repairs' 
    AND column_name IN ('status', 'final_issue_type', 'updated_at')
ORDER BY column_name;

-- Check constraints
SELECT 
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'repairs'
    AND con.conname IN ('valid_status', 'valid_issue_type');


-- ============================================================
-- MIGRATION COMPLETE!
-- ============================================================
-- Next step: Run tests
-- cd /workspace/client && node test-e2e.js
-- Expected: 24/24 tests passing
-- ============================================================
