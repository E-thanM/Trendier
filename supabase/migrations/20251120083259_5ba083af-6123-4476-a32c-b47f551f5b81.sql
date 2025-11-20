-- Add image_url column to post_comments for comment images
ALTER TABLE post_comments ADD COLUMN image_url TEXT;

-- Create a storage bucket for comment images if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-images', 'comment-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for comment images bucket
CREATE POLICY "Anyone can view comment images"
ON storage.objects FOR SELECT
USING (bucket_id = 'comment-images');

CREATE POLICY "Authenticated users can upload comment images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'comment-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own comment images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'comment-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own comment images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'comment-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);