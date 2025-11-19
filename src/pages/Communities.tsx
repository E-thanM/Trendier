import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Users, Lock, MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
import CreateCommunityDialog from "@/components/CreateCommunityDialog";
import CreatePostDialog from "@/components/CreatePostDialog";
import CommunityPosts from "@/components/CommunityPosts";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BottomNav } from "@/components/BottomNav";

export default function Communities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("communities")
        .select(`
          *,
          profiles!communities_created_by_fkey(username, avatar_url)
        `)
        .order("member_count", { ascending: false })
        .limit(6);

      if (searchQuery) {
        query = query.ilike("name", `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: userMemberships } = useQuery({
    queryKey: ["user-memberships"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user.id);

      if (error) throw error;
      return data.map(m => m.community_id);
    },
  });

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Communities Section */}
            <div className="mb-12">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Communities</h2>
                  <p className="text-muted-foreground text-sm">
                    Discover and join fashion communities
                  </p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create
                </Button>
              </div>

              {/* Search */}
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search communities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Communities Grid - Compact */}
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="h-40 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : communities && communities.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {communities.map((community: any) => {
                    const isMember = userMemberships?.includes(community.id);
                    const isPrivate = community.community_type === 'invite_only';

                    return (
                      <Link key={community.id} to={`/communities/${community.slug}`}>
                        <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                          {/* Cover Image */}
                          <div className="h-20 bg-gradient-to-br from-primary to-primary/60 relative">
                            {community.cover_image_url && (
                              <img
                                src={community.cover_image_url}
                                alt={community.name}
                                className="w-full h-full object-cover"
                              />
                            )}
                            {isPrivate && (
                              <div className="absolute top-1 right-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                                <Lock className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-3">
                            <div className="flex flex-col items-center text-center mb-2">
                              {community.avatar_url ? (
                                <img
                                  src={community.avatar_url}
                                  alt={community.name}
                                  className="w-10 h-10 rounded-full object-cover mb-2 -mt-7 border-2 border-background"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2 -mt-7 border-2 border-background">
                                  <Users className="w-5 h-5 text-primary" />
                                </div>
                              )}
                              <h3 className="font-semibold text-sm line-clamp-1">
                                {community.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {community.member_count || 0} members
                              </p>
                            </div>

                            {isMember && (
                              <div className="text-center">
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                  Joined
                                </span>
                              </div>
                            )}
                          </div>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No communities found</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {searchQuery ? "Try a different search term" : "Be the first to create a community"}
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Community
                  </Button>
                </Card>
              )}
            </div>

            {/* Feed Section */}
            <div className="border-t pt-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Community Feed</h2>
                  <p className="text-muted-foreground text-sm">
                    Latest posts from all communities
                  </p>
                </div>
                {currentUser && (
                  <Button onClick={() => setCreatePostOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Post
                  </Button>
                )}
              </div>

              <CommunityPosts communityId={null} />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>

      <CreateCommunityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />

      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        communityId={null}
      />
    </SidebarProvider>
  );
}
