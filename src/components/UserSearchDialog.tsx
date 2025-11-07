import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, MessageCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface UserSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSearchDialog({ open, onOpenChange }: UserSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (searchQuery.trim()) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", `%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMessageUser = async (userId: string) => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error("Auth error:", userError);
        toast({
          title: "Authentication Error",
          description: "Please log out and log back in",
          variant: "destructive",
        });
        return;
      }
      
      if (!user) {
        console.error("No authenticated user found");
        toast({
          title: "Not Authenticated",
          description: "Please log in to send messages",
          variant: "destructive",
        });
        return;
      }

      console.log("Authenticated user ID:", user.id);
      console.log("Target user ID:", userId);

      // Check if conversation already exists
      const { data: existingConversations, error: convCheckError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (convCheckError) {
        console.error("Error checking conversations:", convCheckError);
        throw convCheckError;
      }

      console.log("Existing conversations:", existingConversations);

      if (existingConversations && existingConversations.length > 0) {
        for (const conv of existingConversations) {
          const { data: otherParticipant, error: partError } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", conv.conversation_id)
            .eq("user_id", userId)
            .maybeSingle();

          if (partError) {
            console.error("Error checking participant:", partError);
            continue;
          }

          if (otherParticipant) {
            console.log("Found existing conversation:", conv.conversation_id);
            navigate(`/messages?conversation=${conv.conversation_id}`);
            onOpenChange(false);
            return;
          }
        }
      }

      console.log("Creating new conversation...");
      
      // Use the security definer function to create conversation
      const { data: conversationId, error: convError } = await supabase
        .rpc('create_conversation_for_users', {
          user_id_1: user.id,
          user_id_2: userId
        });

      if (convError) {
        console.error("Conversation creation error details:", {
          message: convError.message,
          details: convError.details,
          hint: convError.hint,
          code: convError.code
        });
        
        toast({
          title: "Failed to Create Conversation",
          description: `Error: ${convError.message}`,
          variant: "destructive",
        });
        return;
      }

      console.log("New conversation created:", conversationId);
      navigate(`/messages?conversation=${conversationId}`);
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Conversation created!",
      });
    } catch (error: any) {
      console.error("Error in handleMessageUser:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Message a User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 hover:bg-accent rounded-lg"
              >
                <button
                  onClick={() => {
                    navigate(`/profile?user=${user.id}`);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <Avatar>
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium hover:underline">{user.username}</p>
                    {user.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </button>
                <Button
                  size="sm"
                  onClick={() => handleMessageUser(user.id)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Message
                </Button>
              </div>
            ))}
          </div>

          {!loading && searchQuery && users.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              No users found
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
