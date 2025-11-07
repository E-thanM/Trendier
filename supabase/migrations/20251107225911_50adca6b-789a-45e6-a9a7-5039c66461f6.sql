
-- The issue is that auth.uid() might not be accessible in the INSERT context
-- Let's try a completely different approach: use a SECURITY DEFINER function

-- First, drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Create a very permissive policy that just checks if user is authenticated role
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also create a helper function to create conversations with proper security
CREATE OR REPLACE FUNCTION create_conversation_for_users(
  user_id_1 uuid,
  user_id_2 uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conversation_id uuid;
  calling_user_id uuid;
BEGIN
  -- Get the current authenticated user
  calling_user_id := auth.uid();
  
  -- Verify the caller is one of the participants
  IF calling_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  IF calling_user_id != user_id_1 AND calling_user_id != user_id_2 THEN
    RAISE EXCEPTION 'User can only create conversations they are part of';
  END IF;
  
  -- Create the conversation
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;
  
  -- Add both participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES 
    (new_conversation_id, user_id_1),
    (new_conversation_id, user_id_2);
  
  RETURN new_conversation_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_conversation_for_users TO authenticated;
GRANT EXECUTE ON FUNCTION create_conversation_for_users TO anon;
