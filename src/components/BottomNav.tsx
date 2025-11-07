import { Home, MessageCircle, Sparkles, TrendingUp, User } from "lucide-react";
import { NavLink } from "./NavLink";
import { Badge } from "@/components/ui/badge";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

export function BottomNav() {
  const { unreadMessages } = useUnreadCounts();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border h-16">
      <div className="flex items-center justify-around h-full px-2">
        <NavLink 
          to="/" 
          end
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors"
          activeClassName="text-primary"
        >
          <Home className="h-6 w-6" />
          <span className="text-xs font-medium">Feed</span>
        </NavLink>
        
        <NavLink 
          to="/messages"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors relative"
          activeClassName="text-primary"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="text-xs font-medium">Messages</span>
          {unreadMessages > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute top-1 right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadMessages}
            </Badge>
          )}
        </NavLink>
        
        <NavLink 
          to="/analyzer" 
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors"
          activeClassName="text-primary"
        >
          <Sparkles className="h-6 w-6" />
          <span className="text-xs font-medium">Analyze</span>
        </NavLink>
        
        <NavLink 
          to="/trends" 
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors"
          activeClassName="text-primary"
        >
          <TrendingUp className="h-6 w-6" />
          <span className="text-xs font-medium">Trends</span>
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg transition-colors"
          activeClassName="text-primary"
        >
          <User className="h-6 w-6" />
          <span className="text-xs font-medium">Profile</span>
        </NavLink>
      </div>
    </nav>
  );
}
