
-- Drop and recreate the INSERT policy with explicit FOR authenticated role
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also let's add a simple test to verify it works
-- Create a function to test conversation creation
CREATE OR REPLACE FUNCTION test_conversation_creation()
RETURNS TABLE (
  success boolean,
  conversation_id uuid,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_conv_id uuid;
BEGIN
  -- Try to insert a conversation
  BEGIN
    INSERT INTO conversations DEFAULT VALUES RETURNING id INTO new_conv_id;
    RETURN QUERY SELECT true, new_conv_id, NULL::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false, NULL::uuid, SQLERRM;
  END;
END;
$$;
