-- Remove foreign key constraint to auth.users
-- The auth schema is not accessible via API, so foreign keys to auth.users cause permission errors
-- We'll rely on RLS policies and application logic instead

ALTER TABLE public.communities
DROP CONSTRAINT IF EXISTS communities_created_by_fkey;