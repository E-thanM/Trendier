import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MoreVertical, Search } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  timestamp: string;
}

interface Conversation {
  id: string;
  username: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unread: boolean;
  messages: Message[];
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    username: "fashion_lover",
    avatar: "",
    lastMessage: "Love your style!",
    timestamp: "1h ago",
    unread: true,
    messages: [
      { id: "1", text: "Love your style!", sender: "them", timestamp: "1h ago" },
      { id: "2", text: "Thanks! Appreciate it 🙌", sender: "me", timestamp: "45m ago" },
      { id: "3", text: "Where did you get that jacket?", sender: "them", timestamp: "30m ago" },
    ],
  },
  {
    id: "2",
    username: "style_icon",
    avatar: "",
    lastMessage: "Where did you get that jacket?",
    timestamp: "3h ago",
    unread: false,
    messages: [
      { id: "1", text: "Hey! Your outfits are amazing", sender: "them", timestamp: "5h ago" },
      { id: "2", text: "Thank you so much!", sender: "me", timestamp: "4h ago" },
      { id: "3", text: "Where did you get that jacket?", sender: "them", timestamp: "3h ago" },
    ],
  },
  {
    id: "3",
    username: "trendy_vibes",
    avatar: "",
    lastMessage: "Can we collab?",
    timestamp: "1d ago",
    unread: false,
    messages: [
      { id: "1", text: "Hi! I follow your style", sender: "them", timestamp: "2d ago" },
      { id: "2", text: "Can we collab?", sender: "them", timestamp: "1d ago" },
    ],
  },
];

export default function Messages() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  const filteredConversations = mockConversations.filter((conv) =>
    conv.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      sender: "me",
      timestamp: "Just now",
    };
    
    setSelectedConversation({
      ...selectedConversation,
      messages: [...selectedConversation.messages, newMessage],
      lastMessage: messageText,
      timestamp: "Just now",
    });
    
    setMessageText("");
  };

  const showList = !isMobile || !selectedConversation;
  const showChat = !isMobile || selectedConversation;

  return (
    <div className="h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] flex">
      {/* Conversations List */}
      {showList && (
        <div className={`${isMobile ? "w-full" : "w-full md:w-96 border-r"} flex flex-col`}>
          {/* Header */}
          <div className="px-4 py-3 border-b">
            <h1 className="text-xl font-bold mb-2">Messages</h1>
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

          {/* Conversations */}
          <ScrollArea className="flex-1">
            <div className="divide-y">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  className={`w-full p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left ${
                    selectedConversation?.id === conversation.id ? "bg-muted" : ""
                  }`}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage src={conversation.avatar} />
                    <AvatarFallback>{conversation.username[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-semibold truncate ${conversation.unread ? "text-foreground" : ""}`}>
                        {conversation.username}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {conversation.timestamp}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate ${conversation.unread ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                        {conversation.lastMessage}
                      </p>
                      {conversation.unread && (
                        <Badge variant="default" className="h-2 w-2 p-0 rounded-full" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Chat Area */}
      {showChat && (
        <div className={`${isMobile ? "w-full" : "flex-1"} flex flex-col`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
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
                  <AvatarImage src={selectedConversation.avatar} />
                  <AvatarFallback>{selectedConversation.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <p className="font-semibold">{selectedConversation.username}</p>
                </div>
                
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {selectedConversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === "me" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[70%] ${message.sender === "me" ? "order-2" : "order-1"}`}>
                        <Card
                          className={`p-3 ${
                            message.sender === "me"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.text}</p>
                        </Card>
                        <p className="text-xs text-muted-foreground mt-1 px-1">
                          {message.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="px-4 py-3 border-t flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Card className="p-8 text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto mb-4">
                  <Send className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Your Messages</h3>
                <p className="text-sm text-muted-foreground">
                  Select a conversation to start chatting
                </p>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
