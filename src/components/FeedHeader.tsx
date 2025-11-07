import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Bell } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";

export function FeedHeader() {
  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "fashion_lover liked your post", time: "2h ago", unread: true },
    { id: 2, text: "style_icon started following you", time: "5h ago", unread: true },
    { id: 3, text: "Your post got 50 likes", time: "1d ago", unread: false },
  ]);

  const messages = [
    { id: 1, from: "fashion_lover", text: "Love your style!", time: "1h ago", unread: true },
    { id: 2, from: "style_icon", text: "Where did you get that jacket?", time: "3h ago", unread: false },
  ];

  const unreadNotifications = notifications.filter(n => n.unread).length;
  const unreadMessages = messages.filter(m => m.unread).length;

  const handleNotificationClick = (notificationId: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
    );
  };

  return (
    <>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b px-4 py-3 md:hidden">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            trendier
          </h1>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className="h-5 w-5" />
              {unreadMessages > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadMessages}
                </Badge>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {unreadNotifications}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Notifications Sheet */}
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-3">
            {notifications.length === 0 ? (
              <Card className="p-8 text-center">
                <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No notifications yet</p>
              </Card>
            ) : (
              notifications.map((notification) => (
                <Card 
                  key={notification.id} 
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    notification.unread ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm flex-1">{notification.text}</p>
                    <span className="text-xs text-muted-foreground ml-2">{notification.time}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
