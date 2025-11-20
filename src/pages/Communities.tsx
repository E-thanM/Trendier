import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Search, Users, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import CreateCommunityDialog from "@/components/CreateCommunityDialog";
import CreatePostDialog from "@/components/CreatePostDialog";
import CommunityPosts from "@/components/CommunityPosts";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { BottomNav } from "@/components/BottomNav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Communities() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("communities")
        .select("*")
        .order("member_count", { ascending: false })
        .limit(20);

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
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
            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search communities or posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Communities Story Strip - Compact */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Communities
                </h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <Plus className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setCreatePostOpen(true)}>
                      Create post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
                      Create community
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Horizontal Scroll - More Compact */}
              {isLoading ? (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Card key={i} className="h-24 w-24 flex-shrink-0 animate-pulse bg-muted rounded-full" />
                  ))}
                </div>
              ) : communities && communities.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                  {communities.map((community: any) => {
                    const isMember = userMemberships?.includes(community.id);
                    const isPrivate = community.community_type === 'invite_only';

                    return (
                      <Link key={community.id} to={`/communities/${community.slug}`} className="flex-shrink-0">
                        <div className="w-20 text-center">
                          <Card className="w-20 h-20 rounded-full overflow-hidden hover:shadow-lg transition-shadow cursor-pointer relative mb-2">
                            {/* Avatar/Cover */}
                            <div className="w-full h-full relative">
                              {community.avatar_url || community.cover_image_url ? (
                                <img
                                  src={community.avatar_url || community.cover_image_url}
                                  alt={community.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                                  <Users className="w-8 h-8 text-white" />
                                </div>
                              )}
                              {isPrivate && (
                                <div className="absolute top-1 right-1 bg-black/50 backdrop-blur-sm p-0.5 rounded-full">
                                  <Lock className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                              {isMember && (
                                <div className="absolute bottom-1 inset-x-1 bg-primary/90 backdrop-blur-sm px-1 py-0.5 rounded-full">
                                  <span className="text-[8px] text-primary-foreground font-medium">
                                    Joined
                                  </span>
                                </div>
                              )}
                            </div>
                          </Card>
                          <p className="text-[10px] font-medium line-clamp-2">
                            {community.name}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Feed Section */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Recommended Posts</h2>
                  <p className="text-muted-foreground text-sm">
                    Latest from all communities
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
