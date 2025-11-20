import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Globe } from "lucide-react";

interface CreateCommunityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCommunityDialog({
  open,
  onOpenChange,
}: CreateCommunityDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [communityType, setCommunityType] = useState<"public" | "invite_only">("public");
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createCommunity = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to be logged in to create a community.");

      const trimmedName = name.trim();
      const trimmedDescription = description.trim();

      if (!trimmedName) {
        throw new Error("Community name cannot be empty.");
      }

      // Generate slug from name
      const slug = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Ensure slug is unique
      const { data: existingCommunity, error: slugCheckError } = await supabase
        .from("communities")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();

      if (slugCheckError && slugCheckError.code !== "PGRST116") {
        // Ignore "No rows found" errors, surface others
        throw slugCheckError;
      }

      if (existingCommunity) {
        throw new Error("A community with this name already exists. Please choose another name.");
      }

      // Create community
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .insert({
          name: trimmedName,
          description: trimmedDescription || null,
          slug,
          community_type: communityType,
          created_by: user.id,
        })
        .select()
        .single();

      if (communityError) throw communityError;

      // Add creator as owner
      const { error: memberError } = await supabase
        .from("community_members")
        .insert({
          community_id: community.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) throw memberError;

      return community;
    },
    onSuccess: (community) => {
      toast({
        title: "Community created!",
        description: "Your community has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      onOpenChange(false);
      setName("");
      setDescription("");
      setCommunityType("public");
      navigate(`/communities/${community.slug}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create community",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create a Community</DialogTitle>
          <DialogDescription>
            Start a new community to connect with others who share your style
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createCommunity.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">Community Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Streetwear Enthusiasts"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What's your community about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="space-y-3">
            <Label>Privacy</Label>
            <RadioGroup
              value={communityType}
              onValueChange={(value: any) => setCommunityType(value)}
            >
              <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
                <RadioGroupItem value="public" id="public" />
                <div className="flex-1">
                  <Label htmlFor="public" className="cursor-pointer flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    <span className="font-medium">Public</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Anyone can find and join this community
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors">
                <RadioGroupItem value="invite_only" id="invite_only" />
                <div className="flex-1">
                  <Label htmlFor="invite_only" className="cursor-pointer flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span className="font-medium">Invite Only</span>
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Only invited members can join
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createCommunity.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name || createCommunity.isPending}>
              {createCommunity.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Create Community
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
