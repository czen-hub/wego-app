import { Link, useLocation } from "react-router-dom";
import { MapPin, Clock, User } from "lucide-react";

const BottomNav = () => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: "/",        icon: MapPin, label: "Home"    },
    { path: "/rides",   icon: Clock,  label: "Rides"   },
    { path: "/account", icon: User,   label: "Account" },
  ];

  return (
    <nav className="bg-card border-t border-border px-2 pt-3 bottom-nav-safe">
      <div className="max-w-2xl mx-auto flex justify-around items-center">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 ${
              isActive(path) ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={22} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
