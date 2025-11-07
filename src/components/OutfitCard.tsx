import { useState } from "react";
import { Heart, MessageCircle, Share2, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

  const handleLike = async () => {
    setIsLiking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to like outfits",
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

  return (
    <Card className="overflow-hidden border-0 shadow-none bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <span className="text-sm font-medium">
            {outfit.profiles?.username?.charAt(0).toUpperCase() || "U"}
          </span>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{outfit.profiles?.username || "Unknown"}</p>
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-muted">
        <img
          src={outfit.image_url}
          alt={outfit.caption || "Outfit"}
          className="w-full h-full object-cover"
        />
        {outfit.rating && (
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="font-bold text-lg">{outfit.rating}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLike}
            disabled={isLiking}
            className={isLiked ? "text-red-500" : ""}
          >
            <Heart className={`h-6 w-6 ${isLiked ? "fill-current" : ""}`} />
          </Button>
          <Button variant="ghost" size="icon">
            <MessageCircle className="h-6 w-6" />
          </Button>
          <Button variant="ghost" size="icon">
            <Share2 className="h-6 w-6" />
          </Button>
          {outfit.trend_match_score && outfit.trend_match_score > 70 && (
            <div className="ml-auto flex items-center gap-1 text-sm text-primary">
              <TrendingUp className="h-4 w-4" />
              <span>{outfit.trend_match_score}% trend match</span>
            </div>
          )}
        </div>

        <div>
          <p className="font-semibold text-sm">{outfit.likes_count} likes</p>
          {outfit.caption && (
            <p className="text-sm mt-1">
              <span className="font-semibold">{outfit.profiles?.username} </span>
              {outfit.caption}
            </p>
          )}
          {outfit.style_tags && outfit.style_tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {outfit.style_tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
