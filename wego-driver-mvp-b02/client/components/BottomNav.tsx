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
    <nav className="bg-card border-t border-border bottom-nav-safe">
      <div className="flex justify-around items-stretch pt-1">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              to={path}
              className="relative flex-1 flex flex-col items-center gap-1 py-2 select-none"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <div className="relative">
                <Icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.75}
                  className={`transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                {badge && !active && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary border-2 border-card" />
                )}
              </div>
              <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
