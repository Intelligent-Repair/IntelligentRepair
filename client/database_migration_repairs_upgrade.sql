-- Migration: Upgrade REPAIRS table with new fields for detailed repair reports
-- This migration adds fields to store comprehensive repair information
--
-- IMPORTANT: Run database_migration_problem_categories.sql FIRST!
-- This migration requires the problem_categories table to exist.
--
-- NOTE: The repairs table already has 'final_issue_type' with the same categories.
-- We're adding 'problem_category' as a new field with FK to problem_categories table
-- for better data integrity. The old 'final_issue_type' remains for backward compatibility.

-- Step 1: Add new columns to repairs table
ALTER TABLE public.repairs 
ADD COLUMN IF NOT EXISTS vehicle_info JSONB NULL,
ADD COLUMN IF NOT EXISTS problem_category VARCHAR(50) NULL,
ADD COLUMN IF NOT EXISTS mechanic_description_ai TEXT NULL,
ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(5,2) NULL,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS garage_request_id UUID NULL;

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

-- Step 3: Add Foreign Key constraint
ALTER TABLE public.repairs 
ADD CONSTRAINT repairs_garage_request_id_fkey 
FOREIGN KEY (garage_request_id) 
REFERENCES public.garage_requests(id) 
ON DELETE SET NULL;

-- Step 4: Add Foreign Key constraint for problem_category (references problem_categories table)
ALTER TABLE public.repairs
ADD CONSTRAINT repairs_problem_category_fkey 
FOREIGN KEY (problem_category) 
REFERENCES public.problem_categories(code) 
ON DELETE RESTRICT;

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_repairs_problem_category ON public.repairs(problem_category) WHERE problem_category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_garage_request_id ON public.repairs(garage_request_id) WHERE garage_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_completed_at ON public.repairs(completed_at) WHERE completed_at IS NOT NULL;

-- Step 6: Migrate existing final_issue_type values to problem_category
-- This copies values from final_issue_type to problem_category for existing records
UPDATE public.repairs
SET problem_category = final_issue_type
WHERE final_issue_type IS NOT NULL 
  AND problem_category IS NULL
  AND final_issue_type IN (
      SELECT code FROM public.problem_categories
  );

-- Step 7: Update existing repairs if needed (optional - for backward compatibility)
-- This sets completed_at = created_at for existing completed repairs
UPDATE public.repairs
SET completed_at = created_at
WHERE status = 'completed' AND completed_at IS NULL;

