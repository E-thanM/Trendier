-- Create outfit analysis queue table
CREATE TABLE IF NOT EXISTS public.outfit_analysis_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  image_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error_message TEXT,
  position INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.outfit_analysis_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue items
CREATE POLICY "Users can view their own queue items"
ON public.outfit_analysis_queue
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own queue items
CREATE POLICY "Users can create their own queue items"
ON public.outfit_analysis_queue
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own queue items
CREATE POLICY "Users can update their own queue items"
ON public.outfit_analysis_queue
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for queue processing
CREATE INDEX idx_queue_status_created ON public.outfit_analysis_queue(status, created_at);
CREATE INDEX idx_queue_user ON public.outfit_analysis_queue(user_id, created_at DESC);