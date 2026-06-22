import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, AlertTriangle, Bot, Settings, LogOut, Calendar, X, Zap } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import NotificationBell from "./NotificationBell";
import { useState, useEffect, useRef } from "react";

const NAV = [
  { href: "/", label: "Team Dashboard", icon: LayoutDashboard },
  { href: "/team", label: "Athlete Roster", icon: Users },
  { href: "/plans", label: "Training Plans", icon: Calendar },
  { href: "/alerts", label: "Injury Alerts", icon: AlertTriangle },
  { href: "/ai-assistant", label: "AveraAI", icon: Bot },
  { href: "/profile", label: "Settings", icon: Settings },
];

function AveraTipPopup() {
  const [tip, setTip] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("avera_tip_shown");
    if (alreadyShown) return;

    const fetchTip = async () => {
      try {
        const res = await fetch("/api/openai/coach-tip", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { tip: string | null };
        if (data.tip) {
          setTip(data.tip);
          setVisible(true);
          sessionStorage.setItem("avera_tip_shown", "1");
          timerRef.current = setTimeout(() => setVisible(false), 30000);
        }
      } catch {
        // silently fail — popup is non-critical
      }
    };

    const delay = setTimeout(fetchTip, 5000);
    return () => {
      clearTimeout(delay);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!visible || dismissed || !tip) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-[#0d1529] border border-cyan-500/30 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-cyan-500/5">
          <div className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-3 h-3 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-cyan-400">AveraAI has a suggestion</span>
          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
        </div>
        <div className="px-4 pb-3 flex items-center gap-2">
          <Link
            href="/ai-assistant"
            onClick={() => setVisible(false)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Open AveraAI →
          </Link>
          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase() || "C"
    : "C";

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-white overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col bg-[#0d1529] border-r border-slate-800">
        <div className="px-5 py-5 border-b border-slate-800 flex items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-500 flex items-center justify-center text-sm font-bold text-slate-900">T</div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide">Thrive</div>
              <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-widest">Coach Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center gap-3">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-xs font-bold">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.firstName ?? "Coach"}</div>
              <div className="text-[10px] text-slate-500 truncate">{user?.email ?? "Thrive Athletics"}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 h-14 border-b border-slate-800 bg-[#0a0f1e]/80 backdrop-blur flex items-center justify-end px-6">
          <NotificationBell />
        </header>
        {children}
      </main>

      <AveraTipPopup />
    </div>
  );
}
