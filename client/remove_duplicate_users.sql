-- Script to find and remove duplicate users from the users table
-- IMPORTANT: Backup your database before running this!

-- Step 1: Check for duplicates (run this first to see what will be deleted)
-- This finds users with duplicate emails
SELECT 
    email,
    COUNT(*) as duplicate_count,
    array_agg(id ORDER BY created_at) as user_ids,
    array_agg(created_at ORDER BY created_at) as created_dates
FROM public.users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Step 2: See detailed information about duplicates
-- This shows all duplicate records with their details
WITH ranked_users AS (
    SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        role,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as rn
    FROM public.users
    WHERE email IN (
        SELECT email 
        FROM public.users 
        GROUP BY email 
        HAVING COUNT(*) > 1
    )
)
SELECT 
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    created_at,
    CASE WHEN rn = 1 THEN 'KEEP' ELSE 'DELETE' END as action
FROM ranked_users
ORDER BY email, created_at;

-- Step 3: Remove duplicates (KEEPS the oldest record for each email)
-- WARNING: This will delete duplicate records. Make sure to backup first!
-- This keeps the user with the earliest created_at date

-- Option A: Delete duplicates based on email (keeps oldest)
-- First, update any foreign key references to point to the kept user
UPDATE public.garages g
SET owner_user_id = (
    SELECT u1.id
    FROM public.users u1
    WHERE u1.email = (
        SELECT u2.email 
        FROM public.users u2 
        WHERE u2.id = g.owner_user_id
    )
    ORDER BY u1.created_at ASC
    LIMIT 1
)
WHERE g.owner_user_id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as rn
        FROM public.users
    ) t
    WHERE t.rn > 1
);

-- Now delete the duplicate users
DELETE FROM public.users
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) as rn
        FROM public.users
    ) t
    WHERE t.rn > 1
);

-- Option B: If you want to keep the one with the most complete data instead:
-- (Uncomment and modify as needed)
/*
DELETE FROM public.users
WHERE id IN (
    SELECT u1.id
    FROM public.users u1
    INNER JOIN public.users u2 ON u1.email = u2.email
    WHERE u1.id > u2.id  -- Keeps the one with smaller ID (usually older)
    AND (
        -- Keep the one with more complete data
        (u1.first_name IS NULL AND u2.first_name IS NOT NULL) OR
        (u1.last_name IS NULL AND u2.last_name IS NOT NULL) OR
        (u1.phone IS NULL AND u2.phone IS NOT NULL)
    )
);
*/

-- Step 4: Verify no duplicates remain
SELECT 
    email,
    COUNT(*) as count
FROM public.users
GROUP BY email
HAVING COUNT(*) > 1;
-- Should return 0 rows if successful

-- Step 5: Update any foreign key references if needed
-- NOTE: This is now done automatically in Step 3 before deletion
-- If you have other tables that reference users.id, add similar UPDATE statements here

