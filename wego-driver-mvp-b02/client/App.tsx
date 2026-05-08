import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Login from "./pages/Login";
import Command from "./pages/Command";
import Earnings from "./pages/Earnings";
import Legacy from "./pages/Legacy";
import Governance from "./pages/Governance";
import Inbox from "./pages/Inbox";
import Settings from "./pages/Settings";
import TripInProgress from "./pages/TripInProgress";
import CourierJobs from "./pages/CourierJobs";
import FoodPickups from "./pages/FoodPickups";
import ScheduledRides from "./pages/ScheduledRides";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-[430px] mx-auto h-screen flex flex-col bg-background">
    <div className="flex-1 overflow-y-auto">
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
    <BottomNav />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicOnlyRoute>
                      <Login />
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Command /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/earnings"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Earnings /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/legacy"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Legacy /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/governance"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Governance /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/inbox"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Inbox /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Settings /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/trip"
                  element={
                    <ProtectedRoute>
                      <TripInProgress />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courier-jobs"
                  element={
                    <ProtectedRoute>
                      <AppLayout><CourierJobs /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/food-pickups"
                  element={
                    <ProtectedRoute>
                      <AppLayout><FoodPickups /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/scheduled-rides"
                  element={
                    <ProtectedRoute>
                      <AppLayout><ScheduledRides /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
