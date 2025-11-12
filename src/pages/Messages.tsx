import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search, Send, Plus, Loader2, Check, CheckCheck, MessageCircle, CheckCheck as MarkAllRead } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      await getCurrentUser();
      await fetchConversations();
    };
    
    init();
  }, []);

  useEffect(() => {
    // Set up realtime subscription
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        fetchConversations();
        if (selectedConversation) {
          const messages = await fetchMessages(selectedConversation.id);
          setSelectedConversation(prev => prev ? {
            ...prev,
            messages: messages,
          } : null);
          // Mark as read if viewing this conversation
          const newMessage = payload.new as any;
          if (newMessage.conversation_id === selectedConversation.id) {
            await markAsRead(selectedConversation.id);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation]);

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId && currentUserId) {
      // Refetch conversations and select the one from URL
      fetchConversations().then((convData) => {
        const conv = convData.find(c => c.id === conversationId);
        if (conv) {
          handleSelectConversation(conv);
        }
      });
    }
  }, [searchParams, currentUserId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      return user.id;
    }
    return null;
  };

  const fetchConversations = async () => {
    try {
      const userId = currentUserId || await getCurrentUser();
      if (!userId) return [];

      const { data: participantData, error: participantError } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (participantError) throw participantError;

      const conversationIds = participantData.map((p) => p.conversation_id);

      if (conversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return [];
      }

      // Filter out conversations with missing participants first
      const { data: participantsCheck } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds)
        .neq("user_id", userId);

      const validConversationIds = conversationIds.filter(convId => 
        participantsCheck?.some(p => p.conversation_id === convId)
      );

      if (validConversationIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return [];
      }

      const { data: otherParticipants, error: otherError } = await supabase
        .from("conversation_participants")
        .select("conversation_id, user_id")
        .in("conversation_id", validConversationIds)
        .neq("user_id", userId);

      if (otherError) throw otherError;

      const otherUserIds = otherParticipants.map((p) => p.user_id);

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", otherUserIds);

      if (profileError) throw profileError;

      const { data: lastMessages } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", validConversationIds)
        .order("created_at", { ascending: false });

      const lastMessageMap = new Map();
      lastMessages?.forEach((msg) => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg);
        }
      });

      // Get user's last_read_at for each conversation
      const { data: userParticipants } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at")
        .eq("user_id", userId)
        .in("conversation_id", validConversationIds);

      // Calculate unread counts
      const unreadCountsMap = new Map();
      for (const conv of validConversationIds) {
        const userPart = userParticipants?.find(p => p.conversation_id === conv);
        const lastReadAt = userPart?.last_read_at || '1970-01-01';
        
        const { count } = await supabase
          .from("messages")
          .select("*", { count: 'exact', head: true })
          .eq("conversation_id", conv)
          .neq("sender_id", userId)
          .gt("created_at", lastReadAt);
        
        unreadCountsMap.set(conv, count || 0);
      }

      const convData: ConversationData[] = validConversationIds.map((convId) => {
        const participant = otherParticipants.find(
          (p) => p.conversation_id === convId
        );
        const profile = profiles.find((p) => p.id === participant?.user_id);
        const lastMsg = lastMessageMap.get(convId);

        return {
          id: convId,
          other_user: {
            id: profile?.id || "",
            username: profile?.username || "Unknown",
            avatar_url: profile?.avatar_url || null,
          },
          last_message: lastMsg?.content || null,
          last_message_at: lastMsg?.created_at || new Date().toISOString(),
          unread_count: unreadCountsMap.get(convId) || 0,
          messages: [],
        };
      }).filter(conv => conv.other_user.id); // Filter out any with missing users

      setConversations(convData);
      setLoading(false);
      return convData;
    } catch (error) {
      console.error("Error fetching conversations:", error);
      setLoading(false);
      return [];
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

      return data || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    // Scroll to bottom whenever messages change or conversation is selected
    if (selectedConversation?.messages.length) {
      // Small delay to ensure DOM is updated
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [selectedConversation?.messages]);

  const handleSelectConversation = async (conversation: ConversationData) => {
    const messages = await fetchMessages(conversation.id);
    setSelectedConversation({
      ...conversation,
      messages: messages,
    });
    await markAsRead(conversation.id);
  };

  const markAsRead = async (conversationId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found, cannot mark as read');
        return;
      }

      // Get the latest message timestamp
      const { data: latestMessages, error: messageError } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (messageError) {
        console.error('Error fetching latest message:', messageError);
      }

      const timestamp = latestMessages && latestMessages.length > 0 
        ? latestMessages[0].created_at 
        : new Date().toISOString();

      console.log('Marking conversation as read:', conversationId, 'timestamp:', timestamp);

      const { error: updateError, data: updateData } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: timestamp })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .select();

      if (updateError) {
        console.error('Error updating last_read_at:', updateError);
        toast({
          title: "Error",
          description: "Failed to mark messages as read",
          variant: "destructive",
        });
        return;
      }

      console.log('Successfully marked as read:', updateData);

      // Update local state immediately
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
      );
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, unread_count: 0 } : null);
      }
    } catch (error) {
      console.error('Error marking as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark messages as read",
        variant: "destructive",
      });
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found, cannot mark all as read');
        return;
      }

      const timestamp = new Date().toISOString();
      console.log('Marking all conversations as read with timestamp:', timestamp);

      // Update all conversation participants for this user
      const { error, data } = await supabase
        .from('conversation_participants')
        .update({ last_read_at: timestamp })
        .eq('user_id', user.id)
        .select();

      if (error) {
        console.error('Error marking all as read:', error);
        toast({
          title: "Error",
          description: "Failed to mark all as read",
          variant: "destructive",
        });
        return;
      }

      console.log('Successfully marked all as read:', data);

      // Update local state
      setConversations(prev =>
        prev.map(c => ({ ...c, unread_count: 0 }))
      );

      if (selectedConversation) {
        setSelectedConversation(prev => prev ? { ...prev, unread_count: 0 } : null);
      }

      toast({
        title: "Success",
        description: "All conversations marked as read",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
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
      const messages = await fetchMessages(selectedConversation.id);
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: messages,
      } : null);
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
              <div className="flex gap-2">
                {selectedConversation && isMobile && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedConversation(null)}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                )}
                {conversations.some(c => c.unread_count > 0) && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={markAllAsRead}
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" onClick={() => setSearchDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New
                </Button>
              </div>
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
                        <p 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `/profile?user=${conversation.other_user.id}`;
                          }}
                          className={`font-semibold truncate hover:underline cursor-pointer ${conversation.unread_count > 0 ? "text-foreground" : ""}`}
                        >
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
                  <p
                    onClick={() => window.location.href = `/profile?user=${selectedConversation.other_user.id}`}
                    className="font-semibold hover:underline cursor-pointer"
                  >
                    {selectedConversation.other_user.username}
                  </p>
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
                  <div ref={messagesEndRef} />
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
