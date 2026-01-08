-- Migration: Create problem_categories table
-- This table stores predefined problem categories used in dashboard and repair reports

-- Step 1: Create problem_categories table
CREATE TABLE IF NOT EXISTS public.problem_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name_he VARCHAR(100) NOT NULL,
  name_en VARCHAR(100) NULL,
  description TEXT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
) TABLESPACE pg_default;

-- Step 2: Insert initial categories (matching dashboard options + additional from REPAIRS)
INSERT INTO public.problem_categories (code, name_he, name_en, description, display_order) VALUES
  ('engine', 'מנוע', 'Engine', 'בעיות מנוע, חום, שמן', 1),
  ('brakes', 'בלמים', 'Brakes', 'בעיות בלימה ומערכת בלמים', 2),
  ('electrical', 'חשמל', 'Electrical', 'בעיות חשמל ומערכות אלקטרוניות', 3),
  ('ac', 'מיזוג אוויר', 'Air Conditioning', 'בעיות מערכת מיזוג אוויר', 4),
  ('starting', 'מערכת התנעה', 'Starting System', 'בעיות התנעה ומצבר', 5),
  ('gearbox', 'תיבת הילוכים', 'Gearbox', 'בעיות תיבת הילוכים והעברת הילוכים', 6),
  ('noise', 'רעש/רטט', 'Noise/Vibration', 'רעשים חריגים ורטטים ברכב', 7),
  ('suspension', 'מתלים', 'Suspension', 'בעיות מערכת מתלים', 8),
  ('transmission', 'תמסורת', 'Transmission', 'בעיות מערכת תמסורת', 9),
  ('fuel_system', 'מערכת דלק', 'Fuel System', 'בעיות מערכת דלק וצריכת דלק', 10),
  ('cooling_system', 'מערכת קירור', 'Cooling System', 'בעיות מערכת קירור מנוע', 11),
  ('exhaust', 'מערכת פליטה', 'Exhaust System', 'בעיות מערכת פליטה', 12),
  ('tires', 'צמיגים', 'Tires', 'בעיות צמיגים ולחץ אוויר', 13),
  ('steering', 'הגה', 'Steering', 'בעיות מערכת היגוי', 14),
  ('other', 'אחר', 'Other', 'בעיות אחרות שאינן נכללות בקטגוריות לעיל', 15)
ON CONFLICT (code) DO NOTHING;

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_problem_categories_code ON public.problem_categories(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_problem_categories_display_order ON public.problem_categories(display_order) WHERE is_active = true;

-- Step 4: Add comment
COMMENT ON TABLE public.problem_categories IS 
'Predefined problem categories for repairs and dashboard filtering. Categories must match between dashboard filters and repair reports.';

