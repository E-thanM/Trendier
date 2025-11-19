import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Bookmark, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface PostDetailDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PostDetailDialog({ postId, open, onOpenChange }: PostDetailDialogProps) {
  const [commentText, setCommentText] = useState("");
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: ["post-detail", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_posts")
        .select(`
          *,
          post_images(id, image_url, display_order)
        `)
        .eq("id", postId)
        .single();

      if (error) throw error;

      // Get profile separately
      if (data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", data.user_id)
          .single();
        
        return { ...data, profile } as any;
      }

      return data as any;
    },
    enabled: open,
  });

  const { data: comments } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_comments")
        .select("*")
        .eq("post_id", postId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);

        return data.map(comment => ({
          ...comment,
          profile: profiles?.find(p => p.id === comment.user_id)
        }));
      }

      return data;
    },
    enabled: open,
  });

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          comment_text: text,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      setCommentText("");
      toast.success("Comment added");
    },
  });

  const handleSubmitComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(commentText);
  };

  if (isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              {post?.profile?.avatar_url && (
                <img src={post.profile.avatar_url} alt={post.profile.username} />
              )}
            </Avatar>
            <span>{post?.profile?.username || "User"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Images Carousel */}
          {post?.post_images && post.post_images.length > 0 && (
            <Carousel className="w-full">
              <CarouselContent>
                {post.post_images.map((img: any) => (
                  <CarouselItem key={img.id}>
                    <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                      <img
                        src={img.image_url}
                        alt="Post"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {post.post_images.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          )}

          {/* Post Content */}
          <div className="space-y-2">
            {post?.title && <h3 className="font-bold text-lg">{post.title}</h3>}
            {post?.caption && <p className="text-sm">{post.caption}</p>}
            <p className="text-xs text-muted-foreground">
              {post?.created_at && formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>

          {/* Engagement */}
          <div className="flex items-center gap-4 py-2 border-y">
            <Button variant="ghost" size="sm">
              <Heart className="w-4 h-4 mr-1" />
              {post?.likes_count || 0}
            </Button>
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-4 h-4 mr-1" />
              {post?.comments_count || 0}
            </Button>
            <Button variant="ghost" size="sm">
              <Bookmark className="w-4 h-4 mr-1" />
              {post?.saves_count || 0}
            </Button>
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <h4 className="font-semibold">Comments</h4>
            {comments?.map((comment: any) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  {comment.profile?.avatar_url && (
                    <img src={comment.profile.avatar_url} alt={comment.profile.username} />
                  )}
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{comment.profile?.username || "User"}</p>
                  <p className="text-sm">{comment.comment_text}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            {(!comments || comments.length === 0) && (
              <p className="text-sm text-muted-foreground">No comments yet</p>
            )}
          </div>

          {/* Add Comment */}
          <div className="flex gap-2">
            <Textarea
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1"
              rows={2}
            />
            <Button onClick={handleSubmitComment} disabled={!commentText.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
