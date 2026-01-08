-- Migration: Add operating_hours column to garages table
-- This migration adds the operating_hours column to store garage operating hours as JSON

-- Add operating_hours column (JSONB type for better performance and querying)
ALTER TABLE public.garages 
ADD COLUMN IF NOT EXISTS operating_hours JSONB NULL;

-- Add comment to explain the column structure
COMMENT ON COLUMN public.garages.operating_hours IS 
'Operating hours stored as JSON array. Format: [{"day": "ראשון", "open": "08:00", "close": "17:00", "isClosed": false}, ...]';

-- Optional: Create an index for garages with operating hours (if you need to query by this)
-- CREATE INDEX IF NOT EXISTS idx_garages_operating_hours ON public.garages USING GIN (operating_hours) WHERE operating_hours IS NOT NULL;

