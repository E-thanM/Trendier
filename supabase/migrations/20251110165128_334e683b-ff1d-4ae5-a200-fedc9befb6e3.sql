-- Ensure conversation_participants table has REPLICA IDENTITY FULL for realtime updates
ALTER TABLE conversation_participants REPLICA IDENTITY FULL;