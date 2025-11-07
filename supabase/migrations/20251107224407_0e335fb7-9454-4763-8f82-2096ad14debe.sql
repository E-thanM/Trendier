-- Drop and recreate with simpler policy
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

CREATE POLICY "Users can create conversations" 
ON conversations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);