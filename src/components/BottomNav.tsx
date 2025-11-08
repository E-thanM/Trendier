import { Home, MessageCircle, Sparkles, TrendingUp, User } from "lucide-react";
import { NavLink } from "./NavLink";
import { Badge } from "@/components/ui/badge";
import { useUnreadCounts } from "@/hooks/use-unread-counts";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function BottomNav() {
  const { unreadMessages } = useUnreadCounts();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRestrictedNavigation = async (path: string, featureName: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const isGuest = localStorage.getItem("guestMode") === "true";
    
    if (!user || isGuest) {
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
          to="/trends" 
          className="flex items-center justify-center p-3 rounded-lg transition-colors"
          activeClassName="text-primary bg-primary/10"
        >
          <TrendingUp className="h-5 w-5" />
        </NavLink>
        
        <button
          onClick={() => handleRestrictedNavigation("/analyzer", "the outfit analyzer")}
          className="flex items-center justify-center p-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="h-5 w-5" />
        </button>
        
        <button
          onClick={() => handleRestrictedNavigation("/messages", "messages")}
          className="flex items-center justify-center p-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground relative"
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
        
        <button
          onClick={() => handleRestrictedNavigation("/profile", "your profile")}
          className="flex items-center justify-center p-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          <User className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}
