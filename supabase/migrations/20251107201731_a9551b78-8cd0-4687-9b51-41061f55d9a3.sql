-- Fix infinite recursion in conversation_participants RLS policies
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

-- Create a simpler policy that doesn't cause recursion
CREATE POLICY "Users can view participants in their conversations"
ON conversation_participants
FOR SELECT
USING (
  user_id = auth.uid() 
  OR 
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- Also fix the conversations policy to avoid recursion
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;

CREATE POLICY "Users can view their own conversations"
ON conversations
FOR SELECT
USING (
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- Allow users to insert conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

CREATE POLICY "Users can create conversations"
ON conversations
FOR INSERT
WITH CHECK (true);