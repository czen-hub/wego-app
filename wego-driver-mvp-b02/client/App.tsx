import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DispatchProvider } from "@/context/DispatchContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import GlobalRideAlert from "@/components/GlobalRideAlert";
import { useState, useEffect, lazy, Suspense } from "react";
import { Loader2, WifiOff } from "lucide-react";
import BottomNav from "@/components/BottomNav";

const Login        = lazy(() => import("./pages/Login"));
const Command      = lazy(() => import("./pages/Command"));
const Earnings     = lazy(() => import("./pages/Earnings"));
const Legacy       = lazy(() => import("./pages/Legacy"));
const Governance   = lazy(() => import("./pages/Governance"));
const Inbox        = lazy(() => import("./pages/Inbox"));
const Settings     = lazy(() => import("./pages/Settings"));
const TripInProgress = lazy(() => import("./pages/TripInProgress"));
const CourierJobs  = lazy(() => import("./pages/CourierJobs"));
const FoodPickups  = lazy(() => import("./pages/FoodPickups"));
const ScheduledRides = lazy(() => import("./pages/ScheduledRides"));
const RideHistory  = lazy(() => import("./pages/RideHistory"));
const NotFound     = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const AppLayout = ({ children, noPadTop, contentClassName = "overflow-y-auto" }: { children: React.ReactNode; noPadTop?: boolean; contentClassName?: string }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return (
    <div className={`${noPadTop ? "" : "app-layout"} relative w-full max-w-[430px] mx-auto h-screen flex flex-col bg-background overflow-hidden`}>
      {!isOnline && (
        <div className="flex-shrink-0 flex items-center justify-center gap-2 bg-destructive px-4 py-2 z-50">
          <WifiOff size={14} className="text-white flex-shrink-0" />
          <p className="text-xs font-semibold text-white">No internet connection</p>
        </div>
      )}
      <div className={`flex-1 min-h-0 ${contentClassName}`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
      <ErrorBoundary><GlobalRideAlert /></ErrorBoundary>
      <BottomNav />
    </div>
  );
};

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
            <DispatchProvider>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <PublicOnlyRoute>
                      <div className="w-full max-w-[430px] mx-auto h-screen bg-background overflow-hidden">
                        <Login />
                      </div>
                    </PublicOnlyRoute>
                  }
                />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout noPadTop contentClassName="relative h-full overflow-hidden flex flex-col"><Command /></AppLayout>
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
                      <div className="w-full max-w-[430px] mx-auto h-screen bg-background overflow-y-auto">
                        <TripInProgress />
                      </div>
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
                <Route
                  path="/history"
                  element={
                    <ProtectedRoute>
                      <AppLayout><RideHistory /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </ErrorBoundary>
            </DispatchProvider>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
