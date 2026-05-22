import { Link, useLocation } from "react-router-dom";
import { MapPin, Clock, User } from "lucide-react";

export default function BottomNav() {
  const { pathname } = useLocation();

  const navItems = [
    {
      path: "/",
      icon: MapPin,
      label: "Home",
      matchPaths: ["/", "/request", "/courier", "/food", "/reserve"],
    },
    {
      path: "/rides",
      icon: Clock,
      label: "Rides",
      matchPaths: ["/rides"],
    },
    {
      path: "/account",
      icon: User,
      label: "Account",
      matchPaths: ["/account"],
    },
  ];

  return (
    <nav className="bg-card border-t border-border bottom-nav-safe">
      <div className="flex justify-around items-stretch pt-1">
        {navItems.map(({ path, icon: Icon, label, matchPaths }) => {
          const active = matchPaths.includes(pathname);
          return (
            <Link
              key={path}
              to={path}
              className="relative flex-1 flex flex-col items-center gap-1 py-2 select-none"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-primary" />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.75}
                className={`transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}
              />
              <span className={`text-[10px] font-semibold transition-colors duration-200 ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
