-- Add public_followers column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN public_followers BOOLEAN DEFAULT true;

-- Update RLS policies for user_follows to respect public_followers setting
DROP POLICY IF EXISTS "Users can view all follows" ON public.user_follows;

-- Users can view their own follows
CREATE POLICY "Users can view their own follows"
ON public.user_follows
FOR SELECT
USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Users can view follows if the profile is public
CREATE POLICY "Users can view public follows"
ON public.user_follows
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_follows.following_id
    AND public_followers = true
  )
);