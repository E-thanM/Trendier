import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MessageSquare, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AccountSettings } from "@/components/AccountSettings";
import { ContactUsForm } from "@/components/ContactUsForm";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
}

interface Notification {
  id: number;
  text: string;
  time: string;
  unread: boolean;
}

export function SettingsSheet({ open, onOpenChange, defaultTab = "settings" }: SettingsSheetProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 1, text: "fashion_lover liked your post", time: "2h ago", unread: true },
    { id: 2, text: "style_icon started following you", time: "5h ago", unread: true },
    { id: 3, text: "Your post got 50 likes", time: "1d ago", unread: false },
  ]);

  // Update active tab when defaultTab changes
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, open]);

  const handleNotificationClick = (notificationId: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, unread: false } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const unreadNotifications = notifications.filter(n => n.unread).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle>Settings & Support</SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="settings" className="transition-all">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="contact" className="transition-all">
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact
            </TabsTrigger>
            <TabsTrigger value="notifications" className="relative transition-all">
              <Bell className="h-4 w-4 mr-2" />
              Alerts
              {unreadNotifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
                >
                  {unreadNotifications}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-6 animate-fade-in">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="contact" className="mt-6 animate-fade-in">
            <ContactUsForm />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6 animate-fade-in">
            {unreadNotifications > 0 && (
              <div className="mb-4 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={markAllAsRead}
                >
                  Mark all as read
                </Button>
              </div>
            )}
            <div className="space-y-3">
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
                    {notification.unread && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">New</Badge>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
