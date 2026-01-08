-- Migration: Add solution_report column to garage_requests table
-- This migration adds the solution_report column to store garage solution reports as JSON

-- Add solution_report column (JSONB type for better performance and querying)
ALTER TABLE public.garage_requests 
ADD COLUMN IF NOT EXISTS solution_report JSONB NULL;

-- Add comment to explain the column structure
COMMENT ON COLUMN public.garage_requests.solution_report IS 
'Solution report stored as JSON. Format: {"problem_found": "...", "solution_applied": "...", "parts_replaced": "...", "labor_hours": 0, "total_cost": 0, "reported_at": "..."}';

