-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can join public communities" ON public.community_members;

-- Create a new policy that allows:
-- 1. Community creators to add themselves as owner
-- 2. Users to join public communities
-- 3. Invited users to accept invites
CREATE POLICY "Users can join communities" 
ON public.community_members 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Allow creator to add themselves as owner
    (role = 'owner' AND EXISTS (
      SELECT 1 FROM communities 
      WHERE id = community_members.community_id 
      AND created_by = auth.uid()
    ))
    OR
    -- Allow joining public communities as member
    (role = 'member' AND EXISTS (
      SELECT 1 FROM communities 
      WHERE id = community_members.community_id 
      AND community_type = 'public'
    ))
    OR
    -- Allow accepting invites
    (EXISTS (
      SELECT 1 FROM community_invites
      WHERE community_id = community_members.community_id 
      AND invited_user_id = auth.uid() 
      AND status = 'pending'
    ))
  )
);