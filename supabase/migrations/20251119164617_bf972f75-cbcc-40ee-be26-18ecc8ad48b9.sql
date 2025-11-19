-- Make community_id nullable to allow posts outside of communities
ALTER TABLE community_posts ALTER COLUMN community_id DROP NOT NULL;

-- Update RLS policies to allow viewing posts outside communities
DROP POLICY IF EXISTS "Users can view posts in communities they're members of" ON community_posts;

CREATE POLICY "Users can view all public posts and community posts they have access to"
ON community_posts FOR SELECT
USING (
  community_id IS NULL OR
  (EXISTS (
    SELECT 1 FROM communities
    WHERE communities.id = community_posts.community_id
    AND communities.community_type = 'public'
  )) OR
  (auth.uid() IN (
    SELECT community_members.user_id
    FROM community_members
    WHERE community_members.community_id = community_posts.community_id
  ))
);

-- Update insert policy to allow posts without community
DROP POLICY IF EXISTS "Community members can create posts" ON community_posts;

CREATE POLICY "Users can create posts"
ON community_posts FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    community_id IS NULL OR
    auth.uid() IN (
      SELECT community_members.user_id
      FROM community_members
      WHERE community_members.community_id = community_posts.community_id
    )
  )
);

-- Update comment policy to allow comments on all visible posts
DROP POLICY IF EXISTS "Community members can comment" ON post_comments;

CREATE POLICY "Users can comment on visible posts"
ON post_comments FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM community_posts cp
    WHERE cp.id = post_comments.post_id
    AND (
      cp.community_id IS NULL OR
      cp.community_id IN (
        SELECT community_id FROM community_members WHERE user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM communities c
        WHERE c.id = cp.community_id AND c.community_type = 'public'
      )
    )
  )
);

-- Seed some default posts with images
DO $$
DECLARE
  sample_user_id uuid;
  post_id_1 uuid;
  post_id_2 uuid;
  post_id_3 uuid;
BEGIN
  -- Get first user
  SELECT id INTO sample_user_id FROM profiles ORDER BY created_at LIMIT 1;
  
  IF sample_user_id IS NOT NULL THEN
    -- Create sample post 1
    INSERT INTO community_posts (user_id, title, caption, community_id)
    VALUES (sample_user_id, 'Street Style Inspo', 'Loving this casual yet elevated look! Perfect for weekend vibes 🔥', NULL)
    RETURNING id INTO post_id_1;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id_1, 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800', 0),
      (post_id_1, 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', 1);
    
    -- Create sample post 2
    INSERT INTO community_posts (user_id, title, caption, community_id)
    VALUES (sample_user_id, 'Vintage Finds', 'Thrifted this amazing jacket yesterday. The quality is incredible!', NULL)
    RETURNING id INTO post_id_2;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id_2, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800', 0);
    
    -- Create sample post 3
    INSERT INTO community_posts (user_id, title, caption, community_id)
    VALUES (sample_user_id, 'Minimalist Aesthetics', 'Sometimes less is more. Clean lines and neutral tones all the way.', NULL)
    RETURNING id INTO post_id_3;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id_3, 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800', 0),
      (post_id_3, 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800', 1),
      (post_id_3, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', 2);
  END IF;
END $$;