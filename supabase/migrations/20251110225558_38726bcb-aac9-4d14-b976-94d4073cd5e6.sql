-- Create outfit analysis cache table
CREATE TABLE IF NOT EXISTS public.outfit_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_cache_key UNIQUE (cache_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_outfit_cache_key ON public.outfit_analysis_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_outfit_cache_created ON public.outfit_analysis_cache(created_at);

-- Enable RLS
ALTER TABLE public.outfit_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own cached results
CREATE POLICY "Users can read their own cache"
  ON public.outfit_analysis_cache
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert/update cache
CREATE POLICY "Service role can manage cache"
  ON public.outfit_analysis_cache
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to auto-delete old cache entries (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_outfit_cache()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.outfit_analysis_cache
  WHERE created_at < NOW() - INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_cleanup_outfit_cache
  AFTER INSERT ON public.outfit_analysis_cache
  EXECUTE FUNCTION public.cleanup_old_outfit_cache();