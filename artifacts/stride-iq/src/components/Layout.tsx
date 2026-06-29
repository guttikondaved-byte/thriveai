import { useState, useEffect } from "react";
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
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
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

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const logoutRedirectUrl = `${window.location.origin}${basePath || "/"}`;

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase() ||
      "A"
    : "A";

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
        data-testid="sidebar"
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <img
            src={`${window.location.origin}${basePath || ""}/logo.svg`}
            alt="Thrive"
            className="w-10 h-10"
          />
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? "opacity-100" : "opacity-70"}`}
                />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt="avatar"
                className="w-8 h-8 rounded-full object-cover border border-border"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {user?.firstName ?? "Athlete"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user?.primaryEmailAddress?.emailAddress ?? ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: logoutRedirectUrl })}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto" data-testid="main-content">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur flex items-center justify-between gap-3 px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  );
}
