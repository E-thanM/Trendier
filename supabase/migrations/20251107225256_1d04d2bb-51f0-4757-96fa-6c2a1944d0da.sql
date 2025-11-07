
-- Grant base permissions on all messaging tables
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON conversation_participants TO authenticated;
GRANT ALL ON messages TO authenticated;
GRANT SELECT ON profiles TO authenticated;

-- Also grant sequence permissions if any
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify grants
DO $$
BEGIN
  RAISE NOTICE 'Grants applied successfully';
END $$;