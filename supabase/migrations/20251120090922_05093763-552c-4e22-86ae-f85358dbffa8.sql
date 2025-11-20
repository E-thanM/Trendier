-- Fix RLS policy on community_invites to avoid querying auth.users (users table)

-- Drop existing SELECT policy that references auth.users
DROP POLICY IF EXISTS "Users can view their own invites" ON public.community_invites;

-- Create a simpler, safe SELECT policy that does not touch auth.users
CREATE POLICY "Users can view invites they are related to"
ON public.community_invites
FOR SELECT
USING (
  auth.uid() = invited_user_id
  OR auth.uid() = invited_by
);
