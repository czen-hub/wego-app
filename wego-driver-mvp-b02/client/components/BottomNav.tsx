import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MapPin, BarChart3, Wallet, Users, Inbox } from "lucide-react";

const BottomNav = () => {
  const location = useLocation();
  const [inboxBadge, setInboxBadge] = useState(true);
  const [govBadge, setGovBadge] = useState(true);

  useEffect(() => {
    if (location.pathname === "/inbox") setInboxBadge(false);
    if (location.pathname === "/governance") setGovBadge(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/",           icon: MapPin,    label: "Command" },
    { path: "/earnings",   icon: BarChart3, label: "Earnings" },
    { path: "/inbox",      icon: Inbox,     label: "Inbox",   badge: inboxBadge },
    { path: "/legacy",     icon: Wallet,    label: "Legacy" },
    { path: "/governance", icon: Users,     label: "Coop",    badge: govBadge },
  ];

  return (
    <nav className="bg-card border-t border-border px-2 pt-3 bottom-nav-safe">
      <div className="max-w-2xl mx-auto flex justify-around items-center">
        {navItems.map(({ path, icon: Icon, label, badge }) => (
          <Link
            key={path}
            to={path}
            className={`relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 ${
              isActive(path)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <div className="relative">
              <Icon size={22} />
              {badge && !isActive(path) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
