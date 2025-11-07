
-- Drop ALL existing policies on conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;

-- Recreate SELECT policy for authenticated users
CREATE POLICY "Users can view their own conversations" 
ON conversations 
FOR SELECT 
TO authenticated
USING (
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

-- Recreate INSERT policy for authenticated users
CREATE POLICY "Users can create conversations" 
ON conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, INSERT ON conversations TO authenticated;
GRANT SELECT, INSERT ON conversation_participants TO authenticated;
GRANT SELECT ON profiles TO authenticated;