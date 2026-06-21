import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, AlertTriangle, BarChart2, Settings, Bot } from "lucide-react";

const NAV = [
  { href: "/", label: "Team Dashboard", icon: LayoutDashboard },
  { href: "/team", label: "Athlete Roster", icon: Users },
  { href: "/alerts", label: "Injury Alerts", icon: AlertTriangle },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/ai-assistant", label: "AveraAI", icon: Bot },
  { href: "/profile", label: "Settings", icon: Settings },
];

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-white overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col bg-[#0d1529] border-r border-slate-800">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center text-sm font-bold text-white">T</div>
            <div>
              <div className="text-sm font-bold text-white tracking-wide">Thrive</div>
              <div className="text-[10px] text-orange-400 font-medium uppercase tracking-widest">Coach Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center text-xs font-bold">C</div>
            <div>
              <div className="text-xs font-semibold text-white">Coach</div>
              <div className="text-[10px] text-slate-500">Thrive Athletics</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
