import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, Upload as UploadIcon, Settings, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { OutfitCard } from "@/components/OutfitCard";
import { SettingsSheet } from "@/components/SettingsSheet";
import { PreferencesSurvey } from "@/components/PreferencesSurvey";
import { FollowersDialog } from "@/components/FollowersDialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

const captionSchema = z.object({
  caption: z.string().trim().max(500, "Caption must be less than 500 characters").optional()
});

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedOutfit, setSelectedOutfit] = useState<any>(null);
  const [likedOutfits, setLikedOutfits] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersDialogOpen, setFollowersDialogOpen] = useState(false);
  const [followersDialogTab, setFollowersDialogTab] = useState<"followers" | "following">("followers");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    initProfile();
    fetchProfile();
    fetchUserOutfits();
    fetchUserLikes();
    fetchFollowCounts();
  }, [searchParams]);

  const initProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const userId = searchParams.get('user');
      setIsOwnProfile(!userId || userId === user.id);
      if (userId && userId !== user.id) {
        checkFollowStatus(userId);
      }
    }
  };

  const checkFollowStatus = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_follows')
      .select('*')
      .eq('follower_id', user.id)
      .eq('following_id', userId)
      .single();

    setIsFollowing(!!data);
  };

  const fetchFollowCounts = async () => {
    const userId = searchParams.get('user') || currentUserId;
    if (!userId) return;

    try {
      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      const { count: followingCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      setFollowersCount(followersCount || 0);
      setFollowingCount(followingCount || 0);
    } catch (error) {
      console.error('Error fetching follow counts:', error);
    }
  };

  const handleFollowToggle = async () => {
    if (!profile) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);
        
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        toast({ title: "Unfollowed user" });
      } else {
        await supabase
          .from('user_follows')
          .insert({
            follower_id: user.id,
            following_id: profile.id,
          });
        
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast({ title: "Following user" });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: "Error",
        description: "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  const handleMessageUser = async () => {
    if (!profile) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if conversation already exists
      const { data: existingConversations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (existingConversations) {
        for (const conv of existingConversations) {
          const { data: otherParticipant } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conv.conversation_id)
            .eq("user_id", profile.id)
            .single();

          if (otherParticipant) {
            navigate(`/messages?conversation=${conv.conversation_id}`);
            return;
          }
        }
      }

      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: participantError } = await supabase
        .from("conversation_participants")
        .insert([
          { conversation_id: newConversation.id, user_id: user.id },
          { conversation_id: newConversation.id, user_id: profile.id },
        ]);

      if (participantError) throw participantError;

      navigate(`/messages?conversation=${newConversation.id}`);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = searchParams.get('user') || user.id;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setProfile(data);
  };

  const fetchUserOutfits = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = searchParams.get('user') || user.id;

    const { data } = await supabase
      .from("outfits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('outfits')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('outfits')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      toast({
        title: "Error",
        description: "Please select an image",
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

      // Upload image to storage
      const imageUrl = await uploadImageToStorage(imageFile);

      // Validate caption
      const validation = captionSchema.safeParse({ caption });
      if (!validation.success) {
        toast({
          title: "Invalid Caption",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setUploading(false);
        return;
      }

      const styleTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error } = await supabase.from("outfits").insert({
        user_id: user.id,
        image_url: imageUrl,
        caption: validation.data.caption || null,
        style_tags: styleTags.length > 0 ? styleTags : null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Outfit uploaded successfully!",
      });

      setImageFile(null);
      setImagePreview("");
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
        <div className="flex items-center justify-between">
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
                <button
                  onClick={() => {
                    setFollowersDialogTab("followers");
                    setFollowersDialogOpen(true);
                  }}
                  className="hover:underline"
                >
                  <span className="font-bold text-foreground">{followersCount}</span>{" "}
                  <span className="text-muted-foreground">followers</span>
                </button>
                <button
                  onClick={() => {
                    setFollowersDialogTab("following");
                    setFollowersDialogOpen(true);
                  }}
                  className="hover:underline"
                >
                  <span className="font-bold text-foreground">{followingCount}</span>{" "}
                  <span className="text-muted-foreground">following</span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 self-start">
            {!isOwnProfile && (
              <>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleMessageUser}
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button 
                  variant={isFollowing ? "outline" : "default"}
                  size="icon"
                  onClick={handleFollowToggle}
                >
                  {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </>
            )}
            {isOwnProfile && (
              <Button 
                variant="outline" 
                size="icon" 
                className="border-border"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>

      {isOwnProfile && (
        <div className="mb-6">
          <PreferencesSurvey />
        </div>
      )}

      <Tabs defaultValue="outfits" className="w-full">
        <TabsList className={`grid w-full ${isOwnProfile ? 'grid-cols-2' : 'grid-cols-1'} mb-6`}>
          <TabsTrigger value="outfits">{isOwnProfile ? 'Your Outfits' : 'Outfits'}</TabsTrigger>
          {isOwnProfile && <TabsTrigger value="upload">Upload</TabsTrigger>}
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
                <Label htmlFor="imageFile">Upload Image</Label>
                <Input
                  ref={fileInputRef}
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  required
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <UploadIcon className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">Upload</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Take a photo or select from gallery
                </p>
              </div>

              {imagePreview && (
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
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
      </Tabs>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      
      <FollowersDialog
        open={followersDialogOpen}
        onOpenChange={setFollowersDialogOpen}
        userId={profile?.id || ""}
        defaultTab={followersDialogTab}
      />

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
