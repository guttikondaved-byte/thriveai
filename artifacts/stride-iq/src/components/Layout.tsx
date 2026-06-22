import { Link, useLocation } from "wouter";
import { LayoutDashboard, Activity, Calendar, AlertTriangle, Bot, User, Zap, HeartPulse, Users, LogOut } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import NotificationBell from "./NotificationBell";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activities", label: "Activities", icon: Activity },
  { href: "/plans", label: "Training Plans", icon: Calendar },
  { href: "/alerts", label: "Injury Alerts", icon: AlertTriangle },
  { href: "/history", label: "Health & History", icon: HeartPulse },
  { href: "/coach", label: "AveraAI", icon: Bot },
  { href: "/team", label: "My Team", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase() || "A"
    : "A";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border flex flex-col" data-testid="sidebar">
        <div className="px-6 py-5 border-b border-border flex items-center">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" strokeWidth={2.5} />
            <span className="text-lg font-semibold tracking-tight text-foreground">Thrive</span>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border space-y-3">
          <div className="flex items-center gap-3">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {user?.firstName ?? "Athlete"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" data-testid="main-content">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur flex items-center justify-end px-6">
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  );
}
