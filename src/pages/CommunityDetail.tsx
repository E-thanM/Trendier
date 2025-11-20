import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Lock, Settings, Plus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BottomNav } from "@/components/BottomNav";
import CommunityPosts from "@/components/CommunityPosts";
import CreatePostDialog from "@/components/CreatePostDialog";

export default function CommunityDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreatePost, setShowCreatePost] = useState(false);

  const { data: community, isLoading } = useQuery({
    queryKey: ["community", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Community not found");
      return data;
    },
  });

  const { data: membership } = useQuery({
    queryKey: ["membership", community?.id],
    enabled: !!community?.id,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("community_members")
        .select("*")
        .eq("community_id", community!.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["community-members", community?.id],
    enabled: !!community?.id && (!!membership || community?.community_type === "public"),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_members")
        .select("user_id, role, joined_at")
        .eq("community_id", community!.id)
        .order("joined_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each member
      const userIds = data.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Merge member data with profile data
      return data.map(member => ({
        ...member,
        profile: profiles?.find(p => p.id === member.user_id) || null,
      }));
    },
  });

  const joinCommunity = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("community_members")
        .insert({
          community_id: community!.id,
          user_id: user.id,
          role: "member",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Joined community!" });
      queryClient.invalidateQueries({ queryKey: ["membership", community?.id] });
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const leaveCommunity = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", community!.id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Left community" });
      queryClient.invalidateQueries({ queryKey: ["membership", community?.id] });
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
    },
  });

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 pb-20 md:pb-0">
            <div className="container mx-auto px-4 py-8">
              <div className="animate-pulse space-y-4">
                <div className="h-48 bg-muted rounded-lg" />
                <div className="h-8 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            </div>
          </main>
          <BottomNav />
        </div>
      </SidebarProvider>
    );
  }

  if (!community) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <main className="flex-1 pb-20 md:pb-0">
            <div className="container mx-auto px-4 py-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Community not found</h2>
              <Button onClick={() => navigate("/communities")}>
                Browse Communities
              </Button>
            </div>
          </main>
          <BottomNav />
        </div>
      </SidebarProvider>
    );
  }

  const isPrivate = community.community_type === "invite_only";
  const isMember = !!membership;
  const isOwner = membership?.role === "owner";
  const isAdmin = membership?.role === "admin" || isOwner;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => navigate("/communities")}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Communities
            </Button>

            {/* Cover Image */}
            <div className="h-48 md:h-64 rounded-lg overflow-hidden mb-6 bg-gradient-to-br from-primary to-primary/60 relative">
              {community.cover_image_url && (
                <img
                  src={community.cover_image_url}
                  alt={community.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            {/* Community Info */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-8">
              <div className="flex items-start gap-4">
                {community.avatar_url ? (
                  <img
                    src={community.avatar_url}
                    alt={community.name}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-10 h-10 text-primary" />
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-3xl font-bold">{community.name}</h1>
                    {isPrivate && (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-muted-foreground mb-2">
                    {community.member_count} members · {community.post_count} posts
                  </p>
                  {community.description && (
                    <p className="text-sm">{community.description}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isMember ? (
                  <>
                    <Button onClick={() => setShowCreatePost(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      New Post
                    </Button>
                    {isAdmin && (
                      <Button variant="outline">
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Button>
                    )}
                    {!isOwner && (
                      <Button
                        variant="outline"
                        onClick={() => leaveCommunity.mutate()}
                      >
                        Leave
                      </Button>
                    )}
                  </>
                ) : isPrivate ? (
                  <Button disabled>
                    <Lock className="w-4 h-4 mr-2" />
                    Invite Only
                  </Button>
                ) : (
                  <Button onClick={() => joinCommunity.mutate()}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Join Community
                  </Button>
                )}
              </div>
            </div>

            {/* Content Tabs */}
            {isMember || !isPrivate ? (
              <Tabs defaultValue="posts" className="w-full">
                <TabsList>
                  <TabsTrigger value="posts">Posts</TabsTrigger>
                  <TabsTrigger value="members">Members</TabsTrigger>
                </TabsList>
                <TabsContent value="posts" className="mt-6">
                  <CommunityPosts communityId={community.id} />
                </TabsContent>
                <TabsContent value="members" className="mt-6">
                  {membersLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 p-4 bg-card rounded-lg animate-pulse">
                          <div className="w-12 h-12 rounded-full bg-muted" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-1/4" />
                            <div className="h-3 bg-muted rounded w-1/6" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : members && members.length > 0 ? (
                    <div className="space-y-3">
                      {members.map(member => (
                        <div key={member.user_id} className="flex items-center gap-3 p-4 bg-card rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground font-semibold overflow-hidden">
                            {member.profile?.avatar_url ? (
                              <img src={member.profile.avatar_url} alt={member.profile.username} className="w-full h-full object-cover" />
                            ) : (
                              <span>{member.profile?.username?.[0]?.toUpperCase() || "?"}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{member.profile?.username || "Unknown User"}</p>
                            <p className="text-sm text-muted-foreground capitalize">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      No members yet
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  This is a private community. You must be invited to view posts.
                </p>
              </div>
            )}
          </div>
        </main>
        <BottomNav />
      </div>

      <CreatePostDialog
        open={showCreatePost}
        onOpenChange={setShowCreatePost}
        communityId={community.id}
      />
    </SidebarProvider>
  );
}
