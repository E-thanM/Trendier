import { Home, TrendingUp, Sparkles, User, LogOut, MessageCircle, Bell } from "lucide-react";
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

const items = [
  { title: "Feed", url: "/", icon: Home },
  { title: "Messages", url: "/messages", icon: MessageCircle },
  { title: "Analyzer", url: "/analyzer", icon: Sparkles },
  { title: "Trends", url: "/trends", icon: TrendingUp },
  { title: "Profile", url: "/profile", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState("settings");

  // Mock data for unread counts
  const unreadMessages = 2;
  const unreadNotifications = 3;

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  const openSettings = (tab: string) => {
    setDefaultTab(tab);
    setSettingsOpen(true);
  };

  const isCollapsed = state === "collapsed";

  return (
    <>
      <Sidebar collapsible="icon" className="hidden md:flex">
        <SidebarContent>
          <div className="h-14 px-4 border-b flex items-center justify-between gap-3">
            <h1 className={`font-bold text-xl ${isCollapsed ? "text-center" : ""}`}>
              {isCollapsed ? "T" : "trendier"}
            </h1>
            
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="relative h-8 w-8 hover:bg-muted"
                onClick={() => openSettings("notifications")}
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

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-muted/50 relative"
                      activeClassName="bg-muted font-medium"
                    >
                      <item.icon className="h-5 w-5" />
                      {!isCollapsed && <span>{item.title}</span>}
                      {item.title === "Messages" && unreadMessages > 0 && !isCollapsed && (
                        <Badge 
                          variant="destructive" 
                          className="ml-auto h-5 w-5 p-0 flex items-center justify-center text-xs"
                        >
                          {unreadMessages}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                  {!isCollapsed && <span>Logout</span>}
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
