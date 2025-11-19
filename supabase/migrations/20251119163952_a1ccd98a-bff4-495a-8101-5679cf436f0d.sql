-- Create enum for community types
CREATE TYPE community_type AS ENUM ('public', 'invite_only');

-- Create enum for community member roles
CREATE TYPE community_role AS ENUM ('owner', 'admin', 'member');

-- Communities table
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  cover_image_url TEXT,
  community_type community_type NOT NULL DEFAULT 'public',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count INTEGER DEFAULT 1,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community members table
CREATE TABLE community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role community_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- Community invites table
CREATE TABLE community_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  CONSTRAINT invited_user_or_email CHECK (
    (invited_user_id IS NOT NULL AND email IS NULL) OR
    (invited_user_id IS NULL AND email IS NOT NULL)
  )
);

-- Community posts table
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  caption TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post images table (multiple images per post)
CREATE TABLE post_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post tags table (for @mentions)
CREATE TABLE post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES outfit_comments(id) ON DELETE CASCADE,
  tagged_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tagged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT post_or_comment CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  )
);

-- Post likes table
CREATE TABLE post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Post comments table (linking to existing outfit_comments structure)
CREATE TABLE post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved collections table (folders/sections for organization)
CREATE TABLE saved_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  cover_image_url TEXT,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saved posts table (linking posts to collections)
CREATE TABLE saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES saved_collections(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(collection_id, post_id)
);

-- Enable RLS on all tables
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Communities
CREATE POLICY "Public communities are viewable by everyone"
  ON communities FOR SELECT
  USING (community_type = 'public' OR auth.uid() IN (
    SELECT user_id FROM community_members WHERE community_id = communities.id
  ));

CREATE POLICY "Users can create communities"
  ON communities FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Community owners/admins can update"
  ON communities FOR UPDATE
  USING (auth.uid() IN (
    SELECT user_id FROM community_members 
    WHERE community_id = communities.id AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Community owners can delete"
  ON communities FOR DELETE
  USING (auth.uid() = created_by);

-- RLS Policies for Community Members
CREATE POLICY "Members can view other members in their communities"
  ON community_members FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM community_members cm2 
    WHERE cm2.community_id = community_members.community_id
  ));

CREATE POLICY "Users can join public communities"
  ON community_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM communities WHERE id = community_id AND community_type = 'public')
      OR EXISTS (SELECT 1 FROM community_invites WHERE community_id = community_members.community_id AND invited_user_id = auth.uid() AND status = 'pending')
    )
  );

CREATE POLICY "Users can leave communities"
  ON community_members FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Community Invites
CREATE POLICY "Users can view their own invites"
  ON community_invites FOR SELECT
  USING (invited_user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Community admins can create invites"
  ON community_invites FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM community_members 
    WHERE community_id = community_invites.community_id AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Invited users can update their invites"
  ON community_invites FOR UPDATE
  USING (invited_user_id = auth.uid());

-- RLS Policies for Community Posts
CREATE POLICY "Users can view posts in communities they're members of"
  ON community_posts FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM communities WHERE id = community_id AND community_type = 'public')
    OR auth.uid() IN (
      SELECT user_id FROM community_members WHERE community_id = community_posts.community_id
    )
  );

CREATE POLICY "Community members can create posts"
  ON community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() IN (SELECT user_id FROM community_members WHERE community_id = community_posts.community_id)
  );

CREATE POLICY "Post authors can update their posts"
  ON community_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Post authors can delete their posts"
  ON community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Post Images
CREATE POLICY "Users can view images from visible posts"
  ON post_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN communities c ON cp.community_id = c.id
      WHERE cp.id = post_images.post_id
      AND (c.community_type = 'public' OR auth.uid() IN (
        SELECT user_id FROM community_members WHERE community_id = c.id
      ))
    )
  );

CREATE POLICY "Post authors can add images"
  ON post_images FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM community_posts WHERE id = post_id AND user_id = auth.uid())
  );

CREATE POLICY "Post authors can delete images"
  ON post_images FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM community_posts WHERE id = post_id AND user_id = auth.uid())
  );

-- RLS Policies for Post Tags
CREATE POLICY "Users can view tags on visible posts"
  ON post_tags FOR SELECT
  USING (true);

CREATE POLICY "Users can create tags"
  ON post_tags FOR INSERT
  WITH CHECK (auth.uid() = tagged_by);

-- RLS Policies for Post Likes
CREATE POLICY "Users can view likes"
  ON post_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Post Comments
CREATE POLICY "Users can view comments on visible posts"
  ON post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM community_posts cp
      JOIN communities c ON cp.community_id = c.id
      WHERE cp.id = post_comments.post_id
      AND (c.community_type = 'public' OR auth.uid() IN (
        SELECT user_id FROM community_members WHERE community_id = c.id
      ))
    )
  );

CREATE POLICY "Community members can comment"
  ON post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM community_posts cp
      WHERE cp.id = post_id
      AND auth.uid() IN (SELECT user_id FROM community_members WHERE community_id = cp.community_id)
    )
  );

CREATE POLICY "Comment authors can update"
  ON post_comments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Comment authors can delete"
  ON post_comments FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Saved Collections
CREATE POLICY "Users can view public collections and their own"
  ON saved_collections FOR SELECT
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can create their own collections"
  ON saved_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own collections"
  ON saved_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own collections"
  ON saved_collections FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Saved Posts
CREATE POLICY "Users can view saves in public collections and their own"
  ON saved_posts FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM saved_collections WHERE id = collection_id AND is_public = true)
  );

CREATE POLICY "Users can save posts to their collections"
  ON saved_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM saved_collections WHERE id = collection_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can remove saves from their collections"
  ON saved_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_communities_type ON communities(community_type);
CREATE INDEX idx_community_members_user ON community_members(user_id);
CREATE INDEX idx_community_members_community ON community_members(community_id);
CREATE INDEX idx_community_posts_community ON community_posts(community_id);
CREATE INDEX idx_community_posts_user ON community_posts(user_id);
CREATE INDEX idx_post_images_post ON post_images(post_id);
CREATE INDEX idx_post_tags_post ON post_tags(post_id);
CREATE INDEX idx_post_tags_tagged_user ON post_tags(tagged_user_id);
CREATE INDEX idx_post_likes_post ON post_likes(post_id);
CREATE INDEX idx_post_comments_post ON post_comments(post_id);
CREATE INDEX idx_saved_collections_user ON saved_collections(user_id);
CREATE INDEX idx_saved_posts_collection ON saved_posts(collection_id);
CREATE INDEX idx_saved_posts_post ON saved_posts(post_id);

-- Create trigger for updated_at
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON communities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_saved_collections_updated_at
  BEFORE UPDATE ON saved_collections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();