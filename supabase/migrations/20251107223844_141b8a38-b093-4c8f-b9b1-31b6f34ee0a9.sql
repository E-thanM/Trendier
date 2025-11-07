-- Drop existing policy
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Recreate policy with correct check
CREATE POLICY "Users can create conversations" 
ON conversations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);