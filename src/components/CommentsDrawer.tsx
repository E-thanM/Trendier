import { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
}

interface CommentsDrawerProps {
  outfitId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CommentsDrawer = ({ outfitId, isOpen, onClose }: CommentsDrawerProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, outfitId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from("outfit_comments")
        .select("*")
        .eq("outfit_id", outfitId)
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      // Merge profiles with comments
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const enrichedComments = commentsData?.map(comment => ({
        ...comment,
        profiles: profilesMap.get(comment.user_id) || null
      })) || [];

      setComments(enrichedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to comment",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("outfit_comments")
        .insert({
          outfit_id: outfitId,
          user_id: user.id,
          comment_text: newComment.trim(),
        });

      if (error) throw error;

      setNewComment("");
      fetchComments();
      
      toast({
        title: "Success",
        description: "Comment posted!",
      });
    } catch (error) {
      console.error("Error posting comment:", error);
      toast({
        title: "Error",
        description: "Failed to post comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const commentsContent = (
    <>
      <ScrollArea className="flex-1 px-3 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-xs">No comments yet</p>
            <p className="text-[10px] mt-0.5">Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center ring-1 ring-primary/20 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-primary">
                    {comment.profiles?.username?.charAt(0).toUpperCase() || "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs">
                      {comment.profiles?.username || "Unknown"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 mt-0.5 break-words leading-snug">{comment.comment_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmitComment} className="px-3 py-2 border-t bg-background">
        <div className="flex gap-1.5">
          <Input
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitting}
            className="flex-1 h-8 text-xs"
          />
          <Button 
            type="submit" 
            disabled={submitting || !newComment.trim()} 
            size="icon"
            className="h-8 w-8"
          >
            {submitting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
          </Button>
        </div>
      </form>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="bottom" className="h-[50vh] p-0 flex flex-col">
          <SheetHeader className="px-3 py-2 border-b">
            <div className="flex items-center justify-center relative">
              <SheetTitle className="text-sm">Comments</SheetTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="absolute right-0 h-7 w-7"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </SheetHeader>
          {commentsContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[400px] p-0 flex flex-col gap-0">
        <DialogHeader className="px-3 py-2 border-b">
          <DialogTitle className="text-sm">Comments</DialogTitle>
        </DialogHeader>
        {commentsContent}
      </DialogContent>
    </Dialog>
  );
};