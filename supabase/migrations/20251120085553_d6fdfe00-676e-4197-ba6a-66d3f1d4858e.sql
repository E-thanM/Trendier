-- Remove foreign key constraint from community_members.user_id to auth.users
-- auth.users is not exposed via the API and FK causes permission denied errors
ALTER TABLE public.community_members
DROP CONSTRAINT IF EXISTS community_members_user_id_fkey;