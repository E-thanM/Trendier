-- Create table for scraped TikTok videos
CREATE TABLE public.tiktok_videos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL UNIQUE,
  hashtag text NOT NULL,
  video_url text NOT NULL,
  thumbnail_url text,
  description text,
  author text,
  overall_trend_score integer DEFAULT 0,
  rank integer,
  percentile integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for detected clothing items in videos
CREATE TABLE public.tiktok_detected_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.tiktok_videos(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text NOT NULL,
  trend_score integer NOT NULL,
  confidence integer DEFAULT 100,
  matches_trend text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create table for hashtag tracking
CREATE TABLE public.tiktok_hashtags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hashtag text NOT NULL UNIQUE,
  last_scraped_at timestamp with time zone NOT NULL DEFAULT now(),
  video_count integer DEFAULT 0,
  is_common boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tiktok_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_detected_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiktok_hashtags ENABLE ROW LEVEL SECURITY;

-- Create policies (public read access since this is trend data)
CREATE POLICY "Videos are viewable by everyone"
  ON public.tiktok_videos FOR SELECT
  USING (true);

CREATE POLICY "Detected items are viewable by everyone"
  ON public.tiktok_detected_items FOR SELECT
  USING (true);

CREATE POLICY "Hashtags are viewable by everyone"
  ON public.tiktok_hashtags FOR SELECT
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_tiktok_videos_hashtag ON public.tiktok_videos(hashtag);
CREATE INDEX idx_tiktok_videos_created_at ON public.tiktok_videos(created_at DESC);
CREATE INDEX idx_tiktok_detected_items_video_id ON public.tiktok_detected_items(video_id);
CREATE INDEX idx_tiktok_hashtags_common ON public.tiktok_hashtags(is_common) WHERE is_common = true;

-- Create trigger for updated_at
CREATE TRIGGER update_tiktok_videos_updated_at
  BEFORE UPDATE ON public.tiktok_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert common fashion hashtags
INSERT INTO public.tiktok_hashtags (hashtag, is_common) VALUES
  ('fashion', true),
  ('ootd', true),
  ('style', true),
  ('streetwear', true),
  ('fashiontiktok', true),
  ('outfitinspo', true)
ON CONFLICT (hashtag) DO NOTHING;