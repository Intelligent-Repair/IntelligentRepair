-- Migration: Upgrade REPAIRS table with new fields for detailed repair reports
-- SAFE VERSION - Can be run multiple times without errors
--
-- IMPORTANT: Run database_migration_problem_categories.sql FIRST!
-- This migration requires the problem_categories table to exist.
--
-- NOTE: The repairs table already has 'final_issue_type' with the same categories.
-- We're adding 'problem_category' as a new field with FK to problem_categories table
-- for better data integrity and consistency with dashboard.

-- Step 1: Add new columns to repairs table (IF NOT EXISTS)
DO $$ 
BEGIN
    -- Add vehicle_info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'repairs' AND column_name = 'vehicle_info') THEN
        ALTER TABLE public.repairs ADD COLUMN vehicle_info JSONB NULL;
    END IF;

    -- Add problem_category (new field, separate from final_issue_type)
    -- This will reference problem_categories table for consistency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'repairs' AND column_name = 'problem_category') THEN
        ALTER TABLE public.repairs ADD COLUMN problem_category VARCHAR(50) NULL;
    END IF;

    -- Add mechanic_description_ai (AI-processed version only)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'repairs' AND column_name = 'mechanic_description_ai') THEN
        ALTER TABLE public.repairs ADD COLUMN mechanic_description_ai TEXT NULL;
    END IF;

    -- Add labor_hours
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'repairs' AND column_name = 'labor_hours') THEN
        ALTER TABLE public.repairs ADD COLUMN labor_hours DECIMAL(5,2) NULL;
    END IF;

    -- Add completed_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'repairs' AND column_name = 'completed_at') THEN
        ALTER TABLE public.repairs ADD COLUMN completed_at TIMESTAMP NULL;
    END IF;

    -- Add garage_request_id (link to garage_requests table)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'repairs' AND column_name = 'garage_request_id') THEN
        ALTER TABLE public.repairs ADD COLUMN garage_request_id UUID NULL;
    END IF;
END $$;

-- Step 2: Add comments to explain column purposes
COMMENT ON COLUMN public.repairs.vehicle_info IS 
'Vehicle information copied from garage_request.vehicle_info. Contains: manufacturer, model, year, license_plate';

COMMENT ON COLUMN public.repairs.problem_category IS 
'Problem category code referencing problem_categories table. Must match categories used in dashboard filters.';

COMMENT ON COLUMN public.repairs.mechanic_description_ai IS 
'AI-improved version of mechanic description, processed by ChatGPT in real-time. Only this field is stored (not the original text).';

COMMENT ON COLUMN public.repairs.labor_hours IS 
'Number of labor hours spent on the repair';

COMMENT ON COLUMN public.repairs.completed_at IS 
'Timestamp when the repair was completed';

COMMENT ON COLUMN public.repairs.garage_request_id IS 
'Reference to the garage_request that led to this repair (when status changed to closed_yes)';

-- Step 3: Add Foreign Key constraint for garage_request_id (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_schema = 'public' 
                   AND table_name = 'repairs' 
                   AND constraint_name = 'repairs_garage_request_id_fkey') THEN
        ALTER TABLE public.repairs 
        ADD CONSTRAINT repairs_garage_request_id_fkey 
        FOREIGN KEY (garage_request_id) 
        REFERENCES public.garage_requests(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- Step 4: Add Foreign Key constraint for problem_category (if not exists and if problem_categories table exists)
-- Note: We keep final_issue_type for backward compatibility, but new repairs should use problem_category
DO $$
BEGIN
    -- Check if problem_categories table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'problem_categories') THEN
        -- Check if constraint doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                       WHERE constraint_schema = 'public' 
                       AND table_name = 'repairs' 
                       AND constraint_name = 'repairs_problem_category_fkey') THEN
            ALTER TABLE public.repairs
            ADD CONSTRAINT repairs_problem_category_fkey 
            FOREIGN KEY (problem_category) 
            REFERENCES public.problem_categories(code) 
            ON DELETE RESTRICT;
        END IF;
    ELSE
        RAISE NOTICE 'WARNING: problem_categories table does not exist. Please run database_migration_problem_categories.sql first!';
    END IF;
END $$;

-- Step 4b: Optional - Migrate existing final_issue_type values to problem_category
-- This copies values from final_issue_type to problem_category for existing records
-- Only runs if problem_categories table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' AND table_name = 'problem_categories') THEN
        UPDATE public.repairs
        SET problem_category = final_issue_type
        WHERE final_issue_type IS NOT NULL 
          AND problem_category IS NULL
          AND final_issue_type IN (
              SELECT code FROM public.problem_categories
          );
    END IF;
END $$;

-- Step 5: Create indexes for better query performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_repairs_problem_category ON public.repairs(problem_category) WHERE problem_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_garage_request_id ON public.repairs(garage_request_id) WHERE garage_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_completed_at ON public.repairs(completed_at) WHERE completed_at IS NOT NULL;

-- Step 6: Update existing repairs if needed (optional - for backward compatibility)
-- This sets completed_at = created_at for existing completed repairs
UPDATE public.repairs
SET completed_at = created_at
WHERE status = 'completed' AND completed_at IS NULL;

