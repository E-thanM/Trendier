-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Create a new permissive policy that allows any authenticated user to create conversations
CREATE POLICY "Users can create conversations" 
ON conversations 
FOR INSERT 
TO authenticated
WITH CHECK (true);