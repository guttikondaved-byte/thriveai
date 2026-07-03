import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Activity,
  Calendar,
  AlertTriangle,
  Flame,
  Bot,
  User,
  HeartPulse,
  Users,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/demo", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/activities", label: "Activities", icon: Activity },
  { href: "/demo/plans", label: "Training Plans", icon: Calendar },
  { href: "/demo/alerts", label: "Injury Alerts", icon: AlertTriangle },
  { href: "/demo/intensity", label: "Intensity Map", icon: Flame },
  { href: "/demo/history", label: "Health & History", icon: HeartPulse },
  { href: "/demo/coach", label: "AveraAI", icon: Bot },
  { href: "/demo/team", label: "My Team", icon: Users },
  { href: "/demo/profile", label: "Profile", icon: User },
];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static on desktop, slide-in drawer on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[80vw] border-r border-border bg-background flex flex-col transform transition-transform duration-200 lg:static lg:w-60 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <img src="/logo.svg" alt="Thrive" className="w-10 h-10" />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-3 pt-3 space-y-0.5">
          <button
            onClick={() => navigate("/demo/choose")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Switch demo
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/demo" ? location === "/demo" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                <Icon className={`w-4 h-4 shrink-0 ${active ? "opacity-100" : "opacity-70"}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border">
          <button
            onClick={() => navigate("/sign-up")}
            className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 hover:bg-primary/90 transition-colors shadow-[0_14px_30px_-12px_rgba(46,144,217,0.6)]"
          >
            Sign up free
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto" data-testid="main-content">
        {/* Demo banner */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-3 text-center">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden absolute left-4 text-white/90 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm font-semibold text-white">
            You're viewing a demo with sample data
          </p>
          <button
            onClick={() => navigate("/sign-up")}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-primary hover:bg-white/90 transition-colors"
          >
            Sign up to start tracking →
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
