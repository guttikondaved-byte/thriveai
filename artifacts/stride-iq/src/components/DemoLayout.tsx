import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Activity,
  Calendar,
  AlertTriangle,
  Bot,
  User,
  HeartPulse,
  Users,
  ArrowLeft,
} from "lucide-react";

const navItems = [
  { href: "/demo", label: "Dashboard", icon: LayoutDashboard },
  { href: "/demo/activities", label: "Activities", icon: Activity },
  { href: "/demo/plans", label: "Training Plans", icon: Calendar },
  { href: "/demo/alerts", label: "Injury Alerts", icon: AlertTriangle },
  { href: "/demo/history", label: "Health & History", icon: HeartPulse },
  { href: "/demo/coach", label: "AveraAI", icon: Bot },
  { href: "/demo/team", label: "My Team", icon: Users },
  { href: "/demo/profile", label: "Profile", icon: User },
];

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-background flex-col">
        <div className="px-6 py-5 border-b border-border flex items-center gap-2">
          <img src="/logo.svg" alt="Thrive" className="w-10 h-10" />
        </div>
        <div className="px-3 pt-3">
          <button
            onClick={() => navigate("/")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            Back to site
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/demo" ? location === "/demo" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? "opacity-100" : "opacity-70"}`} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border">
          <button
            onClick={() => navigate("/sign-up")}
            className="w-full rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2.5 hover:bg-primary/90 transition-colors"
          >
            Sign up free
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {/* Demo banner */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-center gap-3 bg-primary px-4 py-3 text-center">
          <button
            onClick={() => navigate("/")}
            className="lg:hidden flex items-center gap-1.5 text-xs font-semibold text-white/90 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
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
