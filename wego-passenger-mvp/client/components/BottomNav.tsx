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
    <nav className="bg-background border-t border-border bottom-nav-safe">
      <div className="flex justify-around items-stretch pt-1.5 pb-0.5">
        {navItems.map(({ path, icon: Icon, label, matchPaths }) => {
          const active = matchPaths.includes(pathname);
          return (
            <Link
              key={path}
              to={path}
              className="flex-1 flex flex-col items-center gap-1 select-none"
            >
              <div
                className={`flex items-center justify-center w-12 h-8 rounded-xl transition-colors duration-200 ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <Icon
                  size={19}
                  strokeWidth={active ? 2.25 : 1.75}
                  className={`transition-colors duration-200 ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] font-semibold tracking-wide pb-1 transition-colors duration-200 ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
