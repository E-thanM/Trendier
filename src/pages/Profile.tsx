import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Upload as UploadIcon, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OutfitCard } from "@/components/OutfitCard";
import { AccountSettings } from "@/components/AccountSettings";
import { ContactUsForm } from "@/components/ContactUsForm";

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<any>(null);
  const [likedOutfits, setLikedOutfits] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
    fetchUserOutfits();
    fetchUserLikes();
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

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const enrichedOutfits = data?.map(outfit => ({
      ...outfit,
      profiles: profileData
    })) || [];

    setOutfits(enrichedOutfits);
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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageUrl) {
      toast({
        title: "Error",
        description: "Please enter an image URL",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to upload",
          variant: "destructive",
        });
        return;
      }

      const styleTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error } = await supabase.from("outfits").insert({
        user_id: user.id,
        image_url: imageUrl,
        caption: caption || null,
        style_tags: styleTags.length > 0 ? styleTags : null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Outfit uploaded successfully!",
      });

      setImageUrl("");
      setCaption("");
      setTags("");
      fetchUserOutfits();
    } catch (error) {
      console.error("Error uploading outfit:", error);
      toast({
        title: "Error",
        description: "Failed to upload outfit",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
    <div className="max-w-4xl mx-auto p-4 pb-24 md:pb-6">
      <Card className="p-6 mb-6 border-border">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center ring-2 ring-primary/20">
              <span className="text-3xl font-bold text-primary">
                {profile?.username?.charAt(0).toUpperCase() || "U"}
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold">{profile?.username || "User"}</h1>
              {profile?.bio && (
                <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>
              )}
              <div className="flex gap-6 mt-3 text-sm">
                <div>
                  <span className="font-bold text-foreground">{outfits.length}</span>{" "}
                  <span className="text-muted-foreground">posts</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="outfits" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="outfits">Outfits</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="contact">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Contact
          </TabsTrigger>
        </TabsList>

        <TabsContent value="outfits">
          {outfits.length === 0 ? (
            <Card className="p-12 text-center border-border">
              <p className="text-muted-foreground text-sm">
                You haven't uploaded any outfits yet
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {outfits.map((outfit, index) => (
                <div
                  key={outfit.id}
                  className="aspect-square bg-muted relative group cursor-pointer overflow-hidden rounded-sm hover-scale animate-fade-in"
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => setSelectedOutfit(outfit)}
                >
                  <img
                    src={outfit.image_url}
                    alt={outfit.caption || "Outfit"}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-end pb-3">
                    {outfit.rating && (
                      <div className="bg-primary/90 text-primary-foreground font-bold text-lg px-3 py-1 rounded-full mb-1 animate-scale-in">
                        {outfit.rating}/10
                      </div>
                    )}
                    {outfit.trend_match_score > 0 && (
                      <span className="text-white text-xs animate-fade-in">
                        {outfit.trend_match_score}% trend match
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upload">
          <Card className="p-6 border-border">
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  required
                />
              </div>

              {imageUrl && (
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={() => {
                      toast({
                        title: "Invalid image",
                        description: "Please check your image URL",
                        variant: "destructive",
                      });
                    }}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="caption">Caption</Label>
                <Textarea
                  id="caption"
                  placeholder="Describe your outfit..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Style Tags</Label>
                <Input
                  id="tags"
                  placeholder="streetwear, minimalist, vintage"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Upload Outfit
                  </>
                )}
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="contact">
          <ContactUsForm />
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedOutfit} onOpenChange={() => setSelectedOutfit(null)}>
        <DialogContent className="max-w-lg p-0 gap-0 bg-transparent border-none shadow-none">
          {selectedOutfit && (
            <OutfitCard
              outfit={selectedOutfit}
              isLiked={likedOutfits.has(selectedOutfit.id)}
              onLikeToggle={() => handleLikeToggle(selectedOutfit.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
