import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Bell } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SettingsSheet } from "@/components/SettingsSheet";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

export function FeedHeader() {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { unreadMessages, unreadNotifications } = useUnreadCounts();

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
              onClick={() => setSettingsOpen(true)}
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

      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        defaultTab="notifications"
      />
    </>
  );
}
