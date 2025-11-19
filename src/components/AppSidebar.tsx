import { Home, TrendingUp, Sparkles, User, LogOut, MessageCircle, Bell, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { SettingsSheet } from "@/components/SettingsSheet";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Analyzer", url: "/analyzer", icon: Sparkles },
  { title: "Trends", url: "/trends", icon: TrendingUp },
  { title: "Forums", url: "/feed", icon: MessageCircle },
  { title: "Communities", url: "/communities", icon: Users },
  { title: "Messages", url: "/messages", icon: MessageCircle },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState("settings");
  const { unreadMessages, unreadNotifications } = useUnreadCounts();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      localStorage.removeItem("guestMode");
      navigate("/auth");
    }
  };

  const handleRestrictedNavigation = async (path: string, featureName: string, e: React.MouseEvent) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.is_anonymous) {
      e.preventDefault();
      toast({
        title: "Sign up required",
        description: `Create an account to access ${featureName}`,
        variant: "destructive",
      });
      return;
    }
    // For authenticated users, allow navigation to proceed
  };

  const handleNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.is_anonymous) {
      toast({
        title: "Sign up required",
        description: "Create an account to access notifications",
        variant: "destructive",
      });
      return;
    }
    openSettings("notifications");
  };

  const openSettings = (tab: string) => {
    setDefaultTab(tab);
    setSettingsOpen(true);
  };

  const isCollapsed = state === "collapsed";

  return (
    <>
      <Sidebar collapsible="icon" className="hidden md:flex">
        <SidebarContent className="flex flex-col h-full">
          <div className="h-14 px-4 border-b flex items-center justify-between gap-2 shrink-0">
            <h1 className={`font-bold text-xl transition-all ${isCollapsed ? "w-full text-center" : ""}`}>
              {isCollapsed ? "T" : "trendier"}
            </h1>
            
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 hover:bg-muted shrink-0"
                onClick={handleNotifications}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
            )}
          </div>

          <SidebarGroup className="flex-1 py-2">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1 px-2">
                {items.map((item) => {
                  const isRestricted = ["Analyzer", "Messages", "Profile"].includes(item.title);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild size="default">
                        <NavLink
                          to={item.url}
                          end
                          onClick={isRestricted ? (e) => handleRestrictedNavigation(item.url, item.title.toLowerCase(), e) : undefined}
                          className="flex w-full items-center gap-2 rounded-md p-2 text-sm hover:bg-muted transition-colors h-10"
                          activeClassName="bg-muted font-medium"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!isCollapsed && <span className="truncate flex-1">{item.title}</span>}
                          {item.title === "Messages" && unreadMessages > 0 && !isCollapsed && (
                            <Badge 
                              variant="destructive" 
                              className="h-5 w-5 p-0 flex items-center justify-center text-xs shrink-0"
                            >
                              {unreadMessages}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout} size="default" className="h-10">
                    <LogOut className="h-4 w-4 shrink-0" />
                    {!isCollapsed && <span className="truncate flex-1">Logout</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      
      <SettingsSheet 
        open={settingsOpen} 
        onOpenChange={setSettingsOpen}
        defaultTab={defaultTab}
      />
    </>
  );
}
