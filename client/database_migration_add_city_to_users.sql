-- Migration: Add city column to users table
-- This migration adds the city column to store user city for both drivers and garages

-- Add city column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.users.city IS 'User city for both drivers and garages';

