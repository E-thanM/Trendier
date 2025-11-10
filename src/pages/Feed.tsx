import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OutfitCard } from "@/components/OutfitCard";
import { StoriesBar } from "@/components/StoriesBar";
import { FeedHeader } from "@/components/FeedHeader";
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

  const trackInteraction = async (outfitId: string, type: 'view' | 'like' | 'comment') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_interactions').insert({
        user_id: user.id,
        outfit_id: outfitId,
        interaction_type: type,
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  };

  const calculateRelevanceScore = (outfit: any, userPreferences: any, userInteractions: any[]) => {
    let score = 0;

    // Base recency score (newer posts get higher scores)
    const ageInDays = (Date.now() - new Date(outfit.created_at).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - ageInDays); // Up to 10 points for recent posts

    // Match style preferences
    if (userPreferences?.style_preferences && outfit.style_tags) {
      const matches = outfit.style_tags.filter((tag: string) =>
        userPreferences.style_preferences.some((pref: string) =>
          tag.toLowerCase().includes(pref.toLowerCase())
        )
      );
      score += matches.length * 5; // 5 points per matching style
    }

    // Boost based on past interactions with similar content
    const similarInteractions = userInteractions.filter((interaction: any) => {
      const interactedOutfit = outfits.find(o => o.id === interaction.outfit_id);
      if (!interactedOutfit) return false;

      // Check if style tags overlap
      const hasOverlap = interactedOutfit.style_tags?.some((tag: string) =>
        outfit.style_tags?.includes(tag)
      );
      return hasOverlap;
    });
    score += similarInteractions.length * 2; // 2 points per similar interaction

    // Boost popular content
    score += (outfit.likes_count || 0) * 0.5; // 0.5 points per like

    // Boost high-rated outfits
    if (outfit.rating) {
      score += outfit.rating * 0.03; // Up to 3 points for 100/100 rating
    }

    // Boost trending outfits
    if (outfit.trend_match_score) {
      score += outfit.trend_match_score * 0.2; // Up to 2 points for matching trends
    }

    return score;
  };

  const fetchOutfits = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let preferences = null;
      let interactions = null;

      // Only fetch user-specific data if authenticated and not anonymous
      if (user && !user.is_anonymous) {
        // Fetch user preferences
        const { data: preferencesData } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
        preferences = preferencesData;

        // Fetch user's recent interactions
        const { data: interactionsData } = await supabase
          .from('user_interactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);
        interactions = interactionsData;
      }

      // Fetch outfits
      const { data: outfitsData, error: outfitsError } = await supabase
        .from("outfits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100); // Get more outfits to sort by relevance

      if (outfitsError) {
        console.error("Error fetching outfits:", outfitsError);
        setOutfits([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(outfitsData?.map(o => o.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      }

      // Merge profiles data with outfits
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const enrichedOutfits = outfitsData?.map(outfit => ({
        ...outfit,
        profiles: profilesMap.get(outfit.user_id) || null
      })) || [];

      // Calculate relevance scores and sort
      const scoredOutfits = enrichedOutfits.map(outfit => ({
        ...outfit,
        relevanceScore: calculateRelevanceScore(outfit, preferences, interactions || [])
      }));

      // Sort by relevance score (higher is better)
      scoredOutfits.sort((a, b) => b.relevanceScore - a.relevanceScore);

      setOutfits(scoredOutfits);

      // Track view interactions for visible outfits (top 10) - only if authenticated
      if (user) {
        scoredOutfits.slice(0, 10).forEach(outfit => {
          trackInteraction(outfit.id, 'view');
        });
      }

      setLoading(false);
    } catch (error) {
      console.error("Error in fetchOutfits:", error);
      setLoading(false);
    }
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

  const handleLikeToggle = async (outfitId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Block guest interactions

    const isCurrentlyLiked = likedOutfits.has(outfitId);

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
              likes_count: isCurrentlyLiked
                ? outfit.likes_count - 1
                : outfit.likes_count + 1,
            }
          : outfit
      )
    );

    // Track like interaction
    if (!isCurrentlyLiked) {
      await trackInteraction(outfitId, 'like');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-6">
      <FeedHeader />
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
