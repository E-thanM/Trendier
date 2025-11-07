import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Settings } from "lucide-react";

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchUserOutfits();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(data);
  };

  const fetchUserOutfits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("outfits")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setOutfits(data || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-20">
      <Card className="p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <span className="text-3xl font-bold">
                {profile?.username?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">{profile?.username || "User"}</h1>
              {profile?.bio && (
                <p className="text-muted-foreground mt-1">{profile.bio}</p>
              )}
              <div className="flex gap-6 mt-3 text-sm">
                <div>
                  <span className="font-bold">{outfits.length}</span> posts
                </div>
              </div>
            </div>
          </div>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <div className="mb-4">
        <h2 className="text-xl font-bold">Your Outfits</h2>
      </div>

      {outfits.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            You haven't uploaded any outfits yet
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="aspect-square bg-muted relative group cursor-pointer"
            >
              <img
                src={outfit.image_url}
                alt={outfit.caption || "Outfit"}
                className="w-full h-full object-cover"
              />
              {outfit.rating && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">{outfit.rating}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
