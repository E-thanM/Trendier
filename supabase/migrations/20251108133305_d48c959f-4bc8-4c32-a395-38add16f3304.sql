-- Create table to store historical trend data
CREATE TABLE IF NOT EXISTS public.trend_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trend_id UUID NOT NULL REFERENCES public.trends(id) ON DELETE CASCADE,
  popularity_score INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trend_history ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing trend history
CREATE POLICY "Trend history is viewable by everyone" 
ON public.trend_history 
FOR SELECT 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_trend_history_trend_id ON public.trend_history(trend_id);
CREATE INDEX idx_trend_history_recorded_at ON public.trend_history(recorded_at DESC);