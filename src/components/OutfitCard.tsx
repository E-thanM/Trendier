import { useState } from "react";
import { Heart, MessageCircle, Share2, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CommentsDrawer } from "@/components/CommentsDrawer";
import { ShareDialog } from "@/components/ShareDialog";
import { FullscreenImageViewer } from "@/components/FullscreenImageViewer";

interface OutfitCardProps {
  outfit: {
    id: string;
    image_url: string;
    caption: string | null;
    rating: number | null;
    style_tags: string[] | null;
    trend_match_score: number | null;
    likes_count: number;
    user_id: string;
    profiles: {
      username: string;
      avatar_url: string | null;
    } | null;
  };
  isLiked: boolean;
  onLikeToggle: () => void;
}

export const OutfitCard = ({ outfit, isLiked, onLikeToggle }: OutfitCardProps) => {
  const [isLiking, setIsLiking] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const { toast } = useToast();

  const trackCommentInteraction = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_interactions').insert({
        user_id: user.id,
        outfit_id: outfit.id,
        interaction_type: 'comment',
      });
    } catch (error) {
      console.error('Error tracking comment interaction:', error);
    }
  };

  const handleCommentsOpen = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.is_anonymous) {
      toast({
        title: "Sign up required",
        description: "Create an account to comment on outfits",
        variant: "destructive",
      });
      return;
    }
    
    setShowComments(true);
    trackCommentInteraction();
  };

  const handleLike = async () => {
    setIsLiking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user || user.is_anonymous) {
        toast({
          title: "Sign up required",
          description: "Create an account to like outfits",
          variant: "destructive",
        });
        return;
      }

      if (isLiked) {
        await supabase
          .from("outfit_likes")
          .delete()
          .eq("outfit_id", outfit.id)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("outfit_likes")
          .insert({ outfit_id: outfit.id, user_id: user.id });
      }

      onLikeToggle();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    } finally {
      setIsLiking(false);
    }
  };

  const handleDoubleClick = () => {
    if (!isLiked) {
      setShowHeart(true);
      handleLike();
      setTimeout(() => setShowHeart(false), 1000);
    }
  };

  return (
    <Card className="overflow-hidden border border-border rounded-lg shadow-lg bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center ring-2 ring-primary/20">
          <span className="text-xs font-semibold text-primary">
            {outfit.profiles?.username?.charAt(0).toUpperCase() || "U"}
          </span>
        </div>
        <div className="flex-1">
          <button 
            onClick={() => window.location.href = `/profile?user=${outfit.user_id}`}
            className="font-semibold text-sm hover:underline cursor-pointer"
          >
            {outfit.profiles?.username || "Unknown"}
          </button>
        </div>
      </div>

      {/* Image */}
      <div 
        className="relative aspect-square bg-muted cursor-pointer select-none"
        onDoubleClick={handleDoubleClick}
        onClick={() => setShowFullscreen(true)}
      >
        <img
          src={outfit.image_url}
          alt={outfit.caption || "Outfit"}
          className="w-full h-full object-cover"
        />
        {outfit.rating && (
          <div className="absolute top-3 right-3 bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="font-bold text-sm text-primary-foreground">{outfit.rating}/10</span>
          </div>
        )}
        {showHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Heart className="w-24 h-24 text-white fill-white animate-scale-in opacity-80" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            disabled={isLiking}
            className={`hover:scale-110 transition-transform ${isLiked ? "text-red-500" : ""}`}
          >
            <Heart className={`h-7 w-7 ${isLiked ? "fill-current" : ""}`} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:scale-110 transition-transform"
            onClick={handleCommentsOpen}
          >
            <MessageCircle className="h-7 w-7" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:scale-110 transition-transform"
            onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              
              if (!user || user.is_anonymous) {
                toast({
                  title: "Sign up required",
                  description: "Create an account to share outfits",
                  variant: "destructive",
                });
                return;
              }
              setShowShare(true);
            }}
          >
            <Share2 className="h-7 w-7" />
          </Button>
          {outfit.trend_match_score && outfit.trend_match_score > 70 && (
            <div className="ml-auto flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full">
              <TrendingUp className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{outfit.trend_match_score}%</span>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="font-semibold text-sm">{outfit.likes_count} likes</p>
          {outfit.caption && (
            <p className="text-sm leading-relaxed">
              <button 
                onClick={() => window.location.href = `/profile?user=${outfit.user_id}`}
                className="font-semibold hover:underline cursor-pointer"
              >
                {outfit.profiles?.username}
              </button>{" "}
              <span className="text-foreground/90">{outfit.caption}</span>
            </p>
          )}
          {outfit.style_tags && outfit.style_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {outfit.style_tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs text-primary cursor-pointer hover:underline"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <CommentsDrawer 
        outfitId={outfit.id}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />
      
      <ShareDialog
        outfitId={outfit.id}
        isOpen={showShare}
        onClose={() => setShowShare(false)}
      />

      <FullscreenImageViewer
        imageUrl={outfit.image_url}
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
      />
    </Card>
  );
};
