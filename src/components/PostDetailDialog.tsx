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
import { Heart, MessageCircle, Bookmark, Send, Image as ImageIcon, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";

interface PostDetailDialogProps {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PostDetailDialog({ postId, open, onOpenChange }: PostDetailDialogProps) {
  const [commentText, setCommentText] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    mutationFn: async ({ text, image }: { text: string; image: File | null }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl: string | null = null;

      // Upload image if provided
      if (image) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('comment-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('comment-images')
          .getPublicUrl(fileName);

        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from("post_comments")
        .insert({
          post_id: postId,
          user_id: user.id,
          comment_text: text,
          image_url: imageUrl,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      setCommentText("");
      setCommentImage(null);
      setCommentImagePreview(null);
      toast.success("Comment added");
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCommentImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setCommentImage(null);
    setCommentImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitComment = () => {
    if (!commentText.trim() && !commentImage) return;
    addComment.mutate({ text: commentText, image: commentImage });
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
                  {comment.image_url && (
                    <div className="mt-2 rounded-lg overflow-hidden max-w-xs">
                      <img 
                        src={comment.image_url} 
                        alt="Comment attachment" 
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
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
          <div className="space-y-2">
            {commentImagePreview && (
              <div className="relative inline-block">
                <img 
                  src={commentImagePreview} 
                  alt="Preview" 
                  className="max-w-xs rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="comment-image-input"
                />
                <label htmlFor="comment-image-input">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span className="cursor-pointer">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Add Image
                    </span>
                  </Button>
                </label>
              </div>
              <Button 
                onClick={handleSubmitComment} 
                disabled={!commentText.trim() && !commentImage}
                className="self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
