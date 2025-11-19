import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import CommunityPosts from "@/components/CommunityPosts";
import CreatePostDialog from "@/components/CreatePostDialog";
import { FeedHeader } from "@/components/FeedHeader";

export default function Forums() {
  const [createPostOpen, setCreatePostOpen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <FeedHeader />
      
      <main className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Forums</h1>
            <p className="text-muted-foreground mt-1">
              Share your style with the community
            </p>
          </div>
          {currentUser && (
            <Button onClick={() => setCreatePostOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Post
            </Button>
          )}
        </div>

        <CommunityPosts communityId={null} />
      </main>

      <CreatePostDialog
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        communityId={null}
      />
    </div>
  );
}
