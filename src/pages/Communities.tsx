import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Users, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import CreateCommunityDialog from "@/components/CreateCommunityDialog";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BottomNav } from "@/components/BottomNav";

export default function Communities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("communities")
        .select(`
          *,
          community_members!inner(user_id),
          profiles!communities_created_by_fkey(username, avatar_url)
        `)
        .order("created_at", { ascending: false });

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

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h1 className="text-4xl font-bold mb-2">Communities</h1>
                <p className="text-muted-foreground">
                  Discover and join fashion communities
                </p>
              </div>
              <Button onClick={() => setShowCreateDialog(true)} size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Create Community
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12"
              />
            </div>

            {/* Communities Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-64 animate-pulse bg-muted" />
                ))}
              </div>
            ) : communities && communities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communities.map((community: any) => {
                  const isMember = userMemberships?.includes(community.id);
                  const isPrivate = community.community_type === 'invite_only';

                  return (
                    <Link key={community.id} to={`/communities/${community.slug}`}>
                      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer h-full">
                        {/* Cover Image */}
                        <div className="h-32 bg-gradient-to-br from-primary to-primary/60 relative">
                          {community.cover_image_url && (
                            <img
                              src={community.cover_image_url}
                              alt={community.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                          {isPrivate && (
                            <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
                              <Lock className="w-3 h-3 text-white" />
                              <span className="text-xs text-white">Private</span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4">
                          <div className="flex items-start gap-3 mb-3">
                            {community.avatar_url ? (
                              <img
                                src={community.avatar_url}
                                alt={community.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg truncate">
                                {community.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {community.member_count} members
                              </p>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {community.description || "No description"}
                          </p>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{community.post_count} posts</span>
                            {isMember && (
                              <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                Joined
                              </span>
                            )}
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No communities found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery
                    ? "Try a different search term"
                    : "Be the first to create a community!"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Community
                  </Button>
                )}
              </Card>
            )}
          </div>
        </main>
        <BottomNav />
      </div>

      <CreateCommunityDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </SidebarProvider>
  );
}
