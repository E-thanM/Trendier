
-- Try granting as postgres user explicitly
ALTER TABLE conversations OWNER TO postgres;
ALTER TABLE conversation_participants OWNER TO postgres;
ALTER TABLE messages OWNER TO postgres;

-- Grant to authenticator role (which authenticated inherits from)
GRANT ALL ON TABLE conversations TO authenticator;
GRANT ALL ON TABLE conversation_participants TO authenticator;
GRANT ALL ON TABLE messages TO authenticator;

-- Grant to authenticated role
GRANT ALL ON TABLE conversations TO authenticated;
GRANT ALL ON TABLE conversation_participants TO authenticated;  
GRANT ALL ON TABLE messages TO authenticated;

-- Grant to anon role as well for testing
GRANT SELECT, INSERT ON TABLE conversations TO anon;
GRANT SELECT, INSERT ON TABLE conversation_participants TO anon;
GRANT SELECT, INSERT ON TABLE messages TO anon;