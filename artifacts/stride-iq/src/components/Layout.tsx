import { Link, useLocation } from "wouter";
import { LayoutDashboard, Activity, Calendar, AlertTriangle, Bot, User, Zap, HeartPulse } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activities", label: "Activities", icon: Activity },
  { href: "/plans", label: "Training Plans", icon: Calendar },
  { href: "/alerts", label: "Injury Alerts", icon: AlertTriangle },
  { href: "/history", label: "Health & History", icon: HeartPulse },
  { href: "/coach", label: "AveraAI", icon: Bot },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-border flex flex-col" data-testid="sidebar">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" strokeWidth={2.5} />
          <span className="text-lg font-semibold tracking-tight text-foreground">Thrive</span>
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
        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground">Thrive v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto" data-testid="main-content">
        {children}
      </main>
    </div>
  );
}
