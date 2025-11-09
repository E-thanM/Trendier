import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import Feed from "./pages/Feed";
import Messages from "./pages/Messages";
import Analyzer from "./pages/Analyzer";
import Trends from "./pages/Trends";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const isMobile = useIsMobile();
  
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <AppSidebar />}
        <main className="flex-1 overflow-auto flex flex-col">
          {!isMobile && (
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b h-14 flex items-center px-4">
              <SidebarTrigger />
            </header>
          )}
          <div className="flex-1">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Feed />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Messages />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyzer"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Analyzer />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trends"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Trends />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Profile />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
