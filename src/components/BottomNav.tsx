import { Home, MessageCircle, Sparkles, TrendingUp, User } from "lucide-react";
import { NavLink } from "./NavLink";
import { Badge } from "@/components/ui/badge";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

export function BottomNav() {
  const { unreadMessages } = useUnreadCounts();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border h-14">
      <div className="flex items-center justify-around h-full px-4">
        <NavLink 
          to="/" 
          end
          className="flex items-center justify-center p-3 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Home className="h-5 w-5" />
        </NavLink>
        
        <NavLink 
          to="/analyzer" 
          className="flex items-center justify-center p-3 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Sparkles className="h-5 w-5" />
        </NavLink>
        
        <NavLink 
          to="/trends" 
          className="flex items-center justify-center p-3 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <TrendingUp className="h-5 w-5" />
        </NavLink>
        
        <NavLink 
          to="/messages"
          className="flex items-center justify-center p-3 rounded-lg transition-colors relative"
          activeClassName="text-primary bg-primary/10"
        >
          <MessageCircle className="h-5 w-5" />
          {unreadMessages > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadMessages}
            </Badge>
          )}
        </NavLink>
        
        <NavLink 
          to="/profile" 
          className="flex items-center justify-center p-3 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <User className="h-5 w-5" />
        </NavLink>
      </div>
    </nav>
  );
}
