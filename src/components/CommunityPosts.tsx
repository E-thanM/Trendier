import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Heart, MessageCircle, Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface CommunityPostsProps {
  communityId: string | null;
}

export default function CommunityPosts({ communityId }: CommunityPostsProps) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ["community-posts", communityId],
    queryFn: async () => {
      let query = supabase
        .from("community_posts")
        .select(`
          id,
          title,
          caption,
          created_at,
          community_id,
          likes_count,
          comments_count,
          saves_count,
          post_images(id, image_url, display_order)
        `);

      if (communityId !== null) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="h-96 animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    // Fallback demo content so the Recommended feed is never empty
    const demoPosts = [
      {
        id: "demo-1",
        title: "Streetwear Essentials",
        caption: "Oversized hoodie, cargo pants and chunky sneakers for a clean everyday look.",
        created_at: new Date().toISOString(),
        likes_count: 128,
        comments_count: 32,
        saves_count: 54,
        post_images: [],
      },
      {
        id: "demo-2",
        title: "Minimal Office Fit",
        caption: "Grey blazer, white tee and tailored trousers – simple but sharp.",
        created_at: new Date().toISOString(),
        likes_count: 94,
        comments_count: 18,
        saves_count: 41,
        post_images: [],
      },
      {
        id: "demo-3",
        title: "Night Out All‑Black",
        caption: "Monochrome all‑black outfit with leather jacket and boots.",
        created_at: new Date().toISOString(),
        likes_count: 210,
        comments_count: 47,
        saves_count: 88,
        post_images: [],
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {demoPosts.map((post) => (
          <Card key={post.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-medium">
                    {post.title?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground">just now • demo</p>
                </div>
              </div>
              {post.caption && (
                <p className="text-sm line-clamp-3 mb-3">{post.caption}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4" />
                  <span>{post.likes_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  <span>{post.comments_count}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Bookmark className="w-4 h-4" />
                  <span>{post.saves_count}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {posts.map((post: any) => {
        const firstImage = post.post_images?.[0];
        const imageCount = post.post_images?.length || 0;

        return (
          <Link key={post.id} to={`/posts/${post.id}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
              {/* Post Image */}
              {firstImage && (
                <div className="aspect-square relative overflow-hidden bg-muted">
                  <img
                    src={firstImage.image_url}
                    alt={post.title || "Post image"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {imageCount > 1 && (
                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full text-white text-xs font-medium">
                      1/{imageCount}
                    </div>
                  )}
                </div>
              )}

              {/* Post Content */}
              <div className="p-4">
                {/* Author */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {post.title?.[0]?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {post.title || "Post"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>

                {/* Caption */}
                {(post.title || post.caption) && (
                  <p className="text-sm line-clamp-2 mb-3">
                    {post.title && <span className="font-semibold">{post.title} </span>}
                    {post.caption}
                  </p>
                )}

                {/* Engagement Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    <span>{post.likes_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.comments_count || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Bookmark className="w-4 h-4" />
                    <span>{post.saves_count || 0}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
