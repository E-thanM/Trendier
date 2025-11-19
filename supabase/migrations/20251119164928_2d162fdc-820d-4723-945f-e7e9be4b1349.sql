-- Seed communities and posts with images
DO $$
DECLARE
  sample_user_id uuid;
  streetwear_comm_id uuid;
  vintage_comm_id uuid;
  minimalist_comm_id uuid;
  luxury_comm_id uuid;
  post_id uuid;
BEGIN
  -- Get first user or create a system user for seeding
  SELECT id INTO sample_user_id FROM profiles ORDER BY created_at LIMIT 1;
  
  IF sample_user_id IS NOT NULL THEN
    -- Create Streetwear Community
    INSERT INTO communities (created_by, name, slug, description, community_type, avatar_url, cover_image_url)
    VALUES (
      sample_user_id,
      'Streetwear Elite',
      'streetwear-elite',
      'Urban fashion, sneaker culture, and street style inspiration. Share your fits and discover the latest drops.',
      'public',
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400',
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200'
    )
    RETURNING id INTO streetwear_comm_id;
    
    -- Add creator as owner
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (streetwear_comm_id, sample_user_id, 'owner');
    
    -- Create Vintage Community
    INSERT INTO communities (created_by, name, slug, description, community_type, avatar_url, cover_image_url)
    VALUES (
      sample_user_id,
      'Vintage Vibes',
      'vintage-vibes',
      'Celebrating retro fashion from the 60s to 90s. Thrift finds, vintage styling tips, and timeless looks.',
      'public',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200'
    )
    RETURNING id INTO vintage_comm_id;
    
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (vintage_comm_id, sample_user_id, 'owner');
    
    -- Create Minimalist Community
    INSERT INTO communities (created_by, name, slug, description, community_type, avatar_url, cover_image_url)
    VALUES (
      sample_user_id,
      'Minimalist Wardrobe',
      'minimalist-wardrobe',
      'Less is more. Quality basics, capsule wardrobes, and timeless minimalist style.',
      'public',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200'
    )
    RETURNING id INTO minimalist_comm_id;
    
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (minimalist_comm_id, sample_user_id, 'owner');
    
    -- Create Luxury Community
    INSERT INTO communities (created_by, name, slug, description, community_type, avatar_url, cover_image_url)
    VALUES (
      sample_user_id,
      'Luxury Fashion',
      'luxury-fashion',
      'Designer pieces, high fashion, and luxury brand discussions. Exclusive community for fashion connoisseurs.',
      'invite_only',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400',
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200'
    )
    RETURNING id INTO luxury_comm_id;
    
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (luxury_comm_id, sample_user_id, 'owner');
    
    -- Seed posts for Streetwear Community
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, streetwear_comm_id, 'Nike Dunk Low Fit', 'Finally copped the Panda Dunks! 🐼 Styled with some baggy cargos and a vintage tee.')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=800', 1);
    
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, streetwear_comm_id, 'Graffiti Wall Photoshoot', 'Found this sick wall downtown. Perfect backdrop for today''s fit check 📸')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800', 1),
      (post_id, 'https://images.unsplash.com/photo-1558769132-cb1aea8f5169?w=800', 2);
    
    -- Seed posts for Vintage Community
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, vintage_comm_id, '90s Thrift Haul', 'Hit the jackpot at the thrift store today! That Levi''s jacket is a dream 😍')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800', 1);
    
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, vintage_comm_id, 'Grandma''s Closet Treasures', 'Raided my grandma''s closet and found these gems from the 70s! Vintage vibes all the way ✨')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800', 0);
    
    -- Seed posts for Minimalist Community
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, minimalist_comm_id, 'Capsule Wardrobe Essentials', 'My entire wardrobe fits in one suitcase. Quality over quantity always 🤍')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800', 1),
      (post_id, 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800', 2);
    
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, minimalist_comm_id, 'Neutral Tones Only', 'When your wardrobe matches your aesthetic perfectly. Beige, white, and black forever.')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', 0);
    
    -- Seed posts for Luxury Community
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, luxury_comm_id, 'Paris Fashion Week Ready', 'Front row ready in Chanel. The details on this piece are incredible 💎')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800', 1);
    
    -- Seed general forum posts (no community)
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, NULL, 'First Post on the Forums!', 'Excited to be here! Can''t wait to share my style journey with everyone 🎉')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800', 0);
    
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, NULL, 'Summer Outfit Inspo', 'Beach day vibes ☀️ Light fabrics and bright colors are my summer essentials.')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800', 1);
    
    INSERT INTO community_posts (user_id, community_id, title, caption)
    VALUES (sample_user_id, NULL, 'Cozy Winter Layers', 'Layering is an art form. Here''s my go-to winter look 🧥❄️')
    RETURNING id INTO post_id;
    
    INSERT INTO post_images (post_id, image_url, display_order)
    VALUES 
      (post_id, 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800', 0),
      (post_id, 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800', 1),
      (post_id, 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800', 2);
    
  END IF;
END $$;