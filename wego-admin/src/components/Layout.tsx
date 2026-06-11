import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { signOut, type User } from "firebase/auth";
import {
  LayoutDashboard, Car, Clock, Users, AlertTriangle, Banknote, LogOut, Sun, Moon, Megaphone, Navigation
} from "lucide-react";
import { auth } from "@/firebase";

const NAV = [
  { to: "/overview",    label: "Overview",      icon: LayoutDashboard },
  { to: "/live-fleet",  label: "Live Fleet",    icon: Navigation },
  { to: "/rides",       label: "Active Rides",  icon: Car },
  { to: "/history",     label: "Ride History",  icon: Clock },
  { to: "/drivers",     label: "Drivers",       icon: Users },
  { to: "/disputes",    label: "Disputes",      icon: AlertTriangle },
  { to: "/payouts",     label: "Payouts",       icon: Banknote },
  { to: "/promotions",  label: "Promotions",    icon: Megaphone },
];

export default function Layout({ user }: { user: User }) {
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("wego_admin_theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("wego_admin_theme", dark ? "dark" : "light");
  }, [dark]);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black text-sm">W</span>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm leading-tight">WeGo Admin</p>
              <p className="text-[10px] text-muted-foreground">Operations Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="px-3 py-4 border-t border-border space-y-2">
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
            <p className="text-[10px] text-muted-foreground">Administrator</p>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
          >
            {dark ? <Sun size={17} className="text-warning" /> : <Moon size={17} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut size={17} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
