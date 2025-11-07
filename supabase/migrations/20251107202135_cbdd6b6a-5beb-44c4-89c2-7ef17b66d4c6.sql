-- Fix infinite recursion by using a more direct approach
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

-- Create a simple policy without subquery on the same table
CREATE POLICY "Users can view participants in their conversations"
ON conversation_participants
FOR SELECT
USING (user_id = auth.uid());

-- Also ensure users can see other participants in their conversations
-- We'll create a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION user_has_access_to_conversation(conversation_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = conversation_uuid
    AND user_id = auth.uid()
  );
END;
$$;

-- Add a policy that uses the function for viewing other participants
CREATE POLICY "Users can view other participants"
ON conversation_participants
FOR SELECT
USING (user_has_access_to_conversation(conversation_id));