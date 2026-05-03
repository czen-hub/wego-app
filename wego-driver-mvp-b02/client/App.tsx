import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import BottomNav from "@/components/BottomNav";
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
            <Route path="/" element={<AppLayout><Command /></AppLayout>} />
            <Route path="/earnings" element={<AppLayout><Earnings /></AppLayout>} />
            <Route path="/legacy" element={<AppLayout><Legacy /></AppLayout>} />
            <Route path="/governance" element={<AppLayout><Governance /></AppLayout>} />
            <Route path="/inbox" element={<AppLayout><Inbox /></AppLayout>} />
            <Route path="/settings" element={<AppLayout><Settings /></AppLayout>} />
            <Route path="/trip" element={<TripInProgress />} />
            <Route path="/courier-jobs" element={<AppLayout><CourierJobs /></AppLayout>} />
            <Route path="/food-pickups" element={<AppLayout><FoodPickups /></AppLayout>} />
            <Route path="/scheduled-rides" element={<AppLayout><ScheduledRides /></AppLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
