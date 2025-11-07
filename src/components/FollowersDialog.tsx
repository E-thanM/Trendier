import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface FollowersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  defaultTab?: "followers" | "following";
}

interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export function FollowersDialog({ open, onOpenChange, userId, defaultTab = "followers" }: FollowersDialogProps) {
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchCurrentUser();
      fetchFollowers();
      fetchFollowing();
    }
  }, [open, userId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchFollowers = async () => {
    try {
      const { data: followData } = await supabase
        .from("user_follows")
        .select("follower_id")
        .eq("following_id", userId);

      if (!followData || followData.length === 0) {
        setFollowers([]);
        return;
      }

      const followerIds = followData.map(f => f.follower_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", followerIds);

      setFollowers(profiles || []);
    } catch (error) {
      console.error("Error fetching followers:", error);
    }
  };

  const fetchFollowing = async () => {
    try {
      const { data: followData } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", userId);

      if (!followData || followData.length === 0) {
        setFollowing([]);
        setLoading(false);
        return;
      }

      const followingIds = followData.map(f => f.following_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", followingIds);

      setFollowing(profiles || []);
    } catch (error) {
      console.error("Error fetching following:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (profileId: string) => {
    onOpenChange(false);
    if (profileId === currentUserId) {
      navigate("/profile");
    } else {
      navigate(`/profile?user=${profileId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="followers">
              Followers {followers.length > 0 && `(${followers.length})`}
            </TabsTrigger>
            <TabsTrigger value="following">
              Following {following.length > 0 && `(${following.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="followers" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : followers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No followers yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {followers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user.id)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.username}</p>
                        {user.bio && (
                          <p className="text-sm text-muted-foreground truncate">{user.bio}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="following" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : following.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Not following anyone yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {following.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleUserClick(user.id)}
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.username}</p>
                        {user.bio && (
                          <p className="text-sm text-muted-foreground truncate">{user.bio}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
