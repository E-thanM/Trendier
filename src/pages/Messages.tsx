import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search, Send, Plus, Loader2, Check, CheckCheck, MessageCircle } from "lucide-react";
import { MessageDropdown } from "@/components/MessageDropdown";
import { UserSearchDialog } from "@/components/UserSearchDialog";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { z } from "zod";

const messageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message must be less than 2000 characters")
});

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
}

interface ConversationData {
  id: string;
  last_message_at: string;
  other_user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  last_message: string | null;
  unread_count: number;
  messages: Message[];
}

export default function Messages() {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationData | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  useEffect(() => {
    getCurrentUser();
    fetchConversations();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchConversations();
        if (selectedConversation) {
          fetchMessages(selectedConversation.id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        handleSelectConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's conversation participations
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (partError) throw partError;

      const conversationIds = participations?.map(p => p.conversation_id) || [];
      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      // Get other participants
      const { data: otherParticipants, error: otherError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', conversationIds)
        .neq('user_id', user.id);

      if (otherError) throw otherError;

      // Get profiles for other users
      const otherUserIds = otherParticipants?.map(p => p.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherUserIds);

      if (profilesError) throw profilesError;

      // Get last messages
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Build conversation data
      const convData: ConversationData[] = conversationIds.map(convId => {
        const otherParticipant = otherParticipants?.find(p => p.conversation_id === convId);
        const otherUser = profiles?.find(p => p.id === otherParticipant?.user_id);
        const lastMsg = messages?.find(m => m.conversation_id === convId);
        const userPart = participations?.find(p => p.conversation_id === convId);
        const unreadCount = messages?.filter(m => 
          m.conversation_id === convId && 
          m.sender_id !== user.id && 
          new Date(m.created_at) > new Date(userPart?.last_read_at || 0)
        ).length || 0;

        return {
          id: convId,
          last_message_at: lastMsg?.created_at || '',
          other_user: {
            id: otherUser?.id || '',
            username: otherUser?.username || 'Unknown',
            avatar_url: otherUser?.avatar_url || null,
          },
          last_message: lastMsg?.content || null,
          unread_count: unreadCount,
          messages: [],
        };
      });

      setConversations(convData.sort((a, b) => 
        new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      ));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (selectedConversation) {
        setSelectedConversation({
          ...selectedConversation,
          messages: data || [],
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSelectConversation = async (conversation: ConversationData) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation.id);
    await markAsRead(conversation.id);
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      // Update local state
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validate message
      const validation = messageSchema.safeParse({ content: messageInput });
      if (!validation.success) {
        toast({
          title: "Invalid Message",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: validation.data.content,
      });

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setMessageInput("");
      await fetchMessages(selectedConversation.id);
      await fetchConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }

      toast({
        title: "Success",
        description: "Conversation deleted",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showList = !isMobile || !selectedConversation;
  const showChat = !isMobile || selectedConversation;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] flex">
      {showList && (
        <div className={`${isMobile ? "w-full" : "w-full md:w-96 border-r"} flex flex-col`}>
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-bold">Messages</h1>
              <Button size="sm" onClick={() => setSearchDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <p className="text-muted-foreground mb-4">No conversations yet</p>
                <Button onClick={() => setSearchDialogOpen(true)}>
                  Start a conversation
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation)}
                    className={`w-full p-3 flex items-start gap-3 text-left transition-colors ${
                      selectedConversation?.id === conversation.id ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={conversation.other_user.avatar_url || undefined} />
                      <AvatarFallback>
                        {conversation.other_user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`font-semibold truncate ${conversation.unread_count > 0 ? "text-foreground" : ""}`}>
                          {conversation.other_user.username}
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(conversation.last_message_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${conversation.unread_count > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                          {conversation.last_message || "No messages yet"}
                        </p>
                        {conversation.unread_count > 0 && (
                          <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                            {conversation.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {showChat && (
        <div className={`${isMobile ? "w-full" : "flex-1"} flex flex-col`}>
          {selectedConversation ? (
            <>
              <div className="px-4 py-3 border-b flex items-center gap-3 flex-shrink-0">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                )}
                
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedConversation.other_user.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedConversation.other_user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <p className="font-semibold">{selectedConversation.other_user.username}</p>
                </div>
                
                <MessageDropdown
                  onDelete={() => handleDeleteConversation(selectedConversation.id)}
                  onArchive={() => toast({ title: "Archive feature coming soon" })}
                />
              </div>

              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {selectedConversation.messages.map((message) => {
                    const isMe = message.sender_id === currentUserId;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[70%]`}>
                          <Card
                            className={`p-3 ${
                              isMe
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                          </Card>
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <p className="text-xs text-muted-foreground">
                              {new Date(message.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {isMe && (
                              message.is_read ? (
                                <CheckCheck className="h-3 w-3 text-primary" />
                              ) : (
                                <Check className="h-3 w-3 text-muted-foreground" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="px-4 py-3 border-t flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      )}

      <UserSearchDialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen} />
    </div>
  );
}
