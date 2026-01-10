-- Test query to verify garage registration data
-- This query checks if a garage registration was successful by joining users and garages tables

-- Check recent garage registrations (last 10)
SELECT 
    u.id as user_id,
    u.email,
    u.phone,
    u.role,
    u.city as user_city,
    u.created_at as user_created_at,
    g.id as garage_id,
    g.garage_name,
    g.license_number,
    g."City" as garage_city,
    g."Street" as garage_street,
    g."Number" as garage_number,
    g.owner_user_id,
    g.created_at as garage_created_at
FROM public.users u
LEFT JOIN public.garages g ON u.id = g.owner_user_id
WHERE u.role = 'garage'
ORDER BY u.created_at DESC
LIMIT 10;

-- Check if there are any garages without matching users (should be empty)
SELECT 
    g.id,
    g.garage_name,
    g.owner_user_id,
    g.created_at
FROM public.garages g
LEFT JOIN public.users u ON g.owner_user_id = u.id
WHERE u.id IS NULL;

-- Check if there are any garage users without matching garage records (should be empty if all registrations completed)
SELECT 
    u.id,
    u.email,
    u.role,
    u.created_at
FROM public.users u
LEFT JOIN public.garages g ON u.id = g.owner_user_id
WHERE u.role = 'garage' AND g.id IS NULL;

