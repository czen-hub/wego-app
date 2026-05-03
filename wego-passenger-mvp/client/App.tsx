import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import BottomNav from "@/components/BottomNav";
import Home from "./pages/Home";
import RideRequest from "./pages/RideRequest";
import RideInProgress from "./pages/RideInProgress";
import RideHistory from "./pages/RideHistory";
import Account from "./pages/Account";
import CourierRequest from "./pages/CourierRequest";
import FoodDelivery from "./pages/FoodDelivery";
import ReserveRide from "./pages/ReserveRide";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-[430px] mx-auto h-screen flex flex-col bg-background">
    <div className="flex-1 overflow-y-auto">
      {children}
    </div>
    <BottomNav />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppLayout><Home /></AppLayout>} />
            <Route path="/request" element={<AppLayout><RideRequest /></AppLayout>} />
            <Route path="/ride" element={<RideInProgress />} />
            <Route path="/rides" element={<AppLayout><RideHistory /></AppLayout>} />
            <Route path="/account" element={<AppLayout><Account /></AppLayout>} />
            <Route path="/courier" element={<AppLayout><CourierRequest /></AppLayout>} />
            <Route path="/food" element={<AppLayout><FoodDelivery /></AppLayout>} />
            <Route path="/reserve" element={<AppLayout><ReserveRide /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
