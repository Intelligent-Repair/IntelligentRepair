-- Safe query to check for duplicate users without deleting anything
-- Run this first to see what duplicates exist

-- 1. Find users with duplicate emails
SELECT 
    email,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ' ORDER BY created_at) as user_ids,
    STRING_AGG(created_at::text, ', ' ORDER BY created_at) as created_dates,
    STRING_AGG(COALESCE(first_name || ' ' || last_name, 'No name'), ', ' ORDER BY created_at) as names
FROM public.users
GROUP BY email
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Show all duplicate records with full details
SELECT 
    id,
    email,
    first_name,
    last_name,
    phone,
    role,
    created_at,
    CASE 
        WHEN ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) = 1
        THEN 'KEEP (oldest)'
        ELSE 'DELETE (duplicate)'
    END as action
FROM public.users
WHERE email IN (
    SELECT email 
    FROM public.users 
    GROUP BY email 
    HAVING COUNT(*) > 1
)
ORDER BY email, created_at;

-- 3. Check if duplicate users have associated garages
SELECT 
    u.email,
    u.id as user_id,
    u.created_at as user_created,
    g.id as garage_id,
    g.garage_name,
    CASE 
        WHEN ROW_NUMBER() OVER (PARTITION BY u.email ORDER BY u.created_at ASC) = 1
        THEN 'KEEP'
        ELSE 'DELETE - has garage reference'
    END as action
FROM public.users u
LEFT JOIN public.garages g ON g.owner_user_id = u.id
WHERE u.email IN (
    SELECT email 
    FROM public.users 
    GROUP BY email 
    HAVING COUNT(*) > 1
)
ORDER BY u.email, u.created_at;

-- 4. Count total duplicates
SELECT 
    COUNT(*) as total_duplicate_users,
    COUNT(DISTINCT email) as unique_emails_with_duplicates
FROM (
    SELECT email, COUNT(*) as cnt
    FROM public.users
    GROUP BY email
    HAVING COUNT(*) > 1
) duplicates;

