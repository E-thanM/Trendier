-- Enable service role to insert detected items
CREATE POLICY "Service role can insert detected items"
ON tiktok_detected_items
FOR INSERT
TO service_role
WITH CHECK (true);

-- Enable service role to manage videos
CREATE POLICY "Service role can insert videos"
ON tiktok_videos
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update videos"
ON tiktok_videos
FOR UPDATE
TO service_role
USING (true);

-- Enable service role to manage hashtags
CREATE POLICY "Service role can insert hashtags"
ON tiktok_hashtags
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update hashtags"
ON tiktok_hashtags
FOR UPDATE
TO service_role
USING (true);