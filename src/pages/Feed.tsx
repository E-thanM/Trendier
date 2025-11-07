import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OutfitCard } from "@/components/OutfitCard";
import { Loader2 } from "lucide-react";

export default function Feed() {
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedOutfits, setLikedOutfits] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchOutfits();
    fetchUserLikes();
  }, []);

  const fetchOutfits = async () => {
    const { data, error } = await supabase
      .from("outfits")
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching outfits:", error);
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
    <div className="max-w-lg mx-auto pb-20">
      {outfits.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No outfits yet. Be the first to upload!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {outfits.map((outfit) => (
            <OutfitCard
              key={outfit.id}
              outfit={outfit}
              isLiked={likedOutfits.has(outfit.id)}
              onLikeToggle={() => handleLikeToggle(outfit.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
