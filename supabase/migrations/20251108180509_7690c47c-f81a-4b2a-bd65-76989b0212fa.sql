-- Enable realtime for trends table
ALTER TABLE public.trends REPLICA IDENTITY FULL;

-- Add trends table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.trends;

-- Enable realtime for trend_history table
ALTER TABLE public.trend_history REPLICA IDENTITY FULL;

-- Add trend_history table to realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.trend_history;