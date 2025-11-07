import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OutfitCard } from "@/components/OutfitCard";
import { StoriesBar } from "@/components/StoriesBar";
import { Loader2, Camera } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function Feed() {
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedOutfits, setLikedOutfits] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchOutfits();
    fetchUserLikes();
  }, []);

  const fetchOutfits = async () => {
    const { data, error } = await supabase
      .from("outfits")
      .select(`
        *,
        profiles (username, avatar_url)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching outfits:", error);
      setOutfits([]);
    } else {
      setOutfits(data || []);
    }
    setLoading(false);
  };

  const fetchUserLikes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("outfit_likes")
      .select("outfit_id")
      .eq("user_id", user.id);

    if (data) {
      setLikedOutfits(new Set(data.map((like) => like.outfit_id)));
    }
  };

  const handleLikeToggle = (outfitId: string) => {
    setLikedOutfits((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(outfitId)) {
        newSet.delete(outfitId);
      } else {
        newSet.add(outfitId);
      }
      return newSet;
    });

    setOutfits((prev) =>
      prev.map((outfit) =>
        outfit.id === outfitId
          ? {
              ...outfit,
              likes_count: likedOutfits.has(outfitId)
                ? outfit.likes_count - 1
                : outfit.likes_count + 1,
            }
          : outfit
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto pb-24 md:pb-6">
      <StoriesBar />
      
      {outfits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
          <Card className="p-12 border-dashed border-2 border-border max-w-md">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
              <Camera className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Posts Yet</h3>
            <p className="text-muted-foreground mb-6 text-sm">
              Start sharing your style! Upload your first outfit to inspire others.
            </p>
            <Button 
              onClick={() => navigate("/profile")}
              className="w-full"
            >
              Upload Your First Outfit
            </Button>
          </Card>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {outfits.map((outfit, index) => (
            <div key={outfit.id} className="animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <OutfitCard
                outfit={outfit}
                isLiked={likedOutfits.has(outfit.id)}
                onLikeToggle={() => handleLikeToggle(outfit.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
