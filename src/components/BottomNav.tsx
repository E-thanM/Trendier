import { Home, MessageCircle, Sparkles, TrendingUp, User, Users, MessageSquare } from "lucide-react";
import { NavLink } from "./NavLink";
import { Badge } from "@/components/ui/badge";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { unreadMessages } = useUnreadCounts();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleRestrictedNavigation = async (path: string, featureName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.is_anonymous) {
      toast({
        title: "Sign up required",
        description: `Create an account to access ${featureName}`,
        variant: "destructive",
      });
      return false;
    }
    navigate(path);
    return true;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border h-14">
      <div className="flex items-center justify-around h-full px-2">
        <NavLink 
          to="/" 
          end
          className="flex items-center justify-center p-2 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <Home className="h-5 w-5" />
        </NavLink>
        
        <NavLink 
          to="/trends" 
          className="flex items-center justify-center p-2 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <TrendingUp className="h-5 w-5" />
        </NavLink>
        
        <NavLink 
          to="/feed" 
          className="flex items-center justify-center p-2 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <MessageSquare className="h-5 w-5" />
        </NavLink>
        
        <button
          onClick={() => handleRestrictedNavigation("/analyzer", "the outfit analyzer")}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg transition-colors",
            location.pathname === "/analyzer" 
              ? "text-primary bg-primary/10" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-5 w-5" />
        </button>
        
        <button
          onClick={() => handleRestrictedNavigation("/messages", "messages")}
          className={cn(
            "flex items-center justify-center p-2 rounded-lg transition-colors relative",
            location.pathname === "/messages" 
              ? "text-primary bg-primary/10" 
              : "text-muted-foreground hover:text-foreground"
          )}
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
        </button>
      </div>
    </nav>
  );
}
