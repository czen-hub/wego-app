import { Zap, Settings } from "lucide-react";
import { Link } from "react-router-dom";

interface TopBarProps {
  activeSeat?: string;
  reliusBonus?: string;
  isOnline?: boolean;
}

const TopBar = ({ activeSeat = "Active Seat #4821", reliusBonus = "+$3.50", isOnline = false }: TopBarProps) => {
  return (
    <div className="sticky top-0 z-10 bg-gradient-to-b from-background via-background to-transparent pb-4">
      <div className="flex items-start gap-2">
        {/* Active Seat Status */}
        <div className="glass-card p-3 flex items-center gap-2 flex-1 min-w-0">
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-500 ${
              isOnline ? "bg-primary animate-pulse" : "bg-muted-foreground/40"
            }`}
          />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {isOnline ? (
                <span className="text-primary font-semibold">ONLINE</span>
              ) : (
                <span>Offline</span>
              )}
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{activeSeat}</p>
          </div>
        </div>

        {/* Cooperative Reliability Bonus */}
        <div className="glass-card p-3 flex items-center gap-2 flex-1 min-w-0">
          <Zap size={16} className="text-secondary flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">No-Surge Bonus</p>
            <p className="text-sm font-semibold text-secondary truncate">{reliusBonus} today</p>
          </div>
        </div>

        {/* Settings button */}
        <Link
          to="/settings"
          className="glass-card p-3 flex items-center justify-center flex-shrink-0 hover:border-primary/40 transition-colors border border-border rounded-xl"
        >
          <Settings size={18} className="text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
};

export default TopBar;
