-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public communities are viewable by everyone" ON public.communities;
DROP POLICY IF EXISTS "Community owners/admins can update" ON public.communities;
DROP POLICY IF EXISTS "Members can view other members in their communities" ON public.community_members;

-- Create security definer function to check community membership
CREATE OR REPLACE FUNCTION public.is_community_member(community_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM community_members
    WHERE community_id = community_uuid
      AND user_id = user_uuid
  );
$$;

-- Create security definer function to check if user is community admin/owner
CREATE OR REPLACE FUNCTION public.is_community_admin(community_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM community_members
    WHERE community_id = community_uuid
      AND user_id = user_uuid
      AND role IN ('owner', 'admin')
  );
$$;

-- Recreate policies using security definer functions
CREATE POLICY "Public communities are viewable by everyone" 
ON public.communities 
FOR SELECT 
USING (
  community_type = 'public'::community_type 
  OR public.is_community_member(id, auth.uid())
);

CREATE POLICY "Community owners/admins can update" 
ON public.communities 
FOR UPDATE 
USING (public.is_community_admin(id, auth.uid()));

CREATE POLICY "Members can view other members in their communities" 
ON public.community_members 
FOR SELECT 
USING (public.is_community_member(community_id, auth.uid()));