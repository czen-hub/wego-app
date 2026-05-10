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
import Home from "./pages/Home";
import RideRequest from "./pages/RideRequest";
import RideInProgress from "./pages/RideInProgress";
import RideHistory from "./pages/RideHistory";
import Account from "./pages/Account";
import CourierRequest from "./pages/CourierRequest";
import FoodDelivery from "./pages/FoodDelivery";
import ReserveRide from "./pages/ReserveRide";
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
                      <AppLayout><Home /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/request"
                  element={
                    <ProtectedRoute>
                      <div className="max-w-[430px] mx-auto h-screen bg-background overflow-hidden">
                        <RideRequest />
                      </div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ride"
                  element={
                    <ProtectedRoute>
                      <div className="max-w-[430px] mx-auto h-screen bg-background overflow-hidden">
                        <RideInProgress />
                      </div>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/rides"
                  element={
                    <ProtectedRoute>
                      <AppLayout><RideHistory /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/account"
                  element={
                    <ProtectedRoute>
                      <AppLayout><Account /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/courier"
                  element={
                    <ProtectedRoute>
                      <AppLayout><CourierRequest /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/food"
                  element={
                    <ProtectedRoute>
                      <AppLayout><FoodDelivery /></AppLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reserve"
                  element={
                    <ProtectedRoute>
                      <AppLayout><ReserveRide /></AppLayout>
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
