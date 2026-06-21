import { AlertTriangle, TrendingUp, Users, Activity, ChevronRight, Flame } from "lucide-react";

type RiskLevel = "ready" | "caution" | "high";

interface TeamAthlete {
  name: string;
  event: string;
  weeklyKm: number;
  hr: number;
  hrv: number;
  risk: RiskLevel;
  riskNote: string;
  trend: "up" | "down" | "flat";
}

const TEAM: TeamAthlete[] = [
  { name: "Alex Chen", event: "5K / 10K", weeklyKm: 58, hr: 62, hrv: 74, risk: "ready", riskNote: "Training well within load limits", trend: "up" },
  { name: "Sam Rivera", event: "Marathon", weeklyKm: 89, hr: 71, hrv: 52, risk: "caution", riskNote: "Mileage spike +28% this week", trend: "flat" },
  { name: "Jordan Park", event: "Cross Country", weeklyKm: 72, hr: 78, hrv: 38, risk: "high", riskNote: "Low HRV + high resting HR — rest advised", trend: "down" },
  { name: "Taylor Kim", event: "Half Marathon", weeklyKm: 64, hr: 65, hrv: 69, risk: "ready", riskNote: "Consistent load, good recovery", trend: "up" },
  { name: "Morgan Liu", event: "Track 1500m", weeklyKm: 51, hr: 60, hrv: 81, risk: "ready", riskNote: "Excellent recovery metrics", trend: "up" },
  { name: "Casey Nguyen", event: "Marathon", weeklyKm: 94, hr: 74, hrv: 44, risk: "caution", riskNote: "Back-to-back long runs this weekend", trend: "flat" },
];

const RISK_CONFIG: Record<RiskLevel, { label: string; dot: string; badge: string; row: string }> = {
  ready:   { label: "Ready",       dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", row: "" },
  caution: { label: "High Load",   dot: "bg-amber-400",   badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",     row: "bg-amber-500/5" },
  high:    { label: "Injury Risk", dot: "bg-red-400 animate-pulse", badge: "bg-red-500/10 text-red-400 border-red-500/20", row: "bg-red-500/5" },
};

const WEEKLY_LOAD = [
  { day: "Mon", load: 62 },
  { day: "Tue", load: 45 },
  { day: "Wed", load: 78 },
  { day: "Thu", load: 38 },
  { day: "Fri", load: 71 },
  { day: "Sat", load: 91 },
  { day: "Sun", load: 28 },
];

const maxLoad = Math.max(...WEEKLY_LOAD.map((d) => d.load));

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="text-3xl font-bold text-white mb-0.5">{value}</div>
      <div className="text-slate-500 text-xs">{sub}</div>
    </div>
  );
}

export default function CoachDashboard() {
  const highRisk = TEAM.filter((a) => a.risk === "high").length;
  const caution = TEAM.filter((a) => a.risk === "caution").length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Thrive Athletics · Week of June 21</p>
        </div>
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="text-red-400" />
          <span className="text-red-400 text-sm font-medium">{highRisk} athlete{highRisk !== 1 ? "s" : ""} need attention</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Athletes" value={TEAM.length} sub="Active this week" icon={Users} accent="bg-cyan-500/10 text-cyan-400" />
        <StatCard label="Injury Risk" value={highRisk} sub={`${caution} on caution`} icon={AlertTriangle} accent="bg-red-500/10 text-red-400" />
        <StatCard label="Team Avg km" value="71.3" sub="km this week" icon={Activity} accent="bg-cyan-500/10 text-cyan-400" />
        <StatCard label="Avg HRV" value="59.7" sub="↓ 4 pts from last week" icon={TrendingUp} accent="bg-violet-500/10 text-violet-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 bg-[#0d1529] border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">Athlete Roster</h2>
            <span className="text-slate-500 text-xs">{TEAM.length} athletes</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {TEAM.map((athlete) => {
              const cfg = RISK_CONFIG[athlete.risk];
              return (
                <div key={athlete.name} className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-800/30 transition-colors ${cfg.row}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {athlete.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{athlete.name}</div>
                    <div className="text-xs text-slate-500">{athlete.event}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-slate-300 font-medium">{athlete.weeklyKm} km</div>
                    <div className="text-[10px] text-slate-600">this week</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-slate-300 font-medium">HR {athlete.hr}</div>
                    <div className="text-[10px] text-slate-600">HRV {athlete.hrv}</div>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium flex-shrink-0 ${cfg.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </div>
                  <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-5">
            <h2 className="font-semibold text-white text-sm mb-4">Team Load This Week</h2>
            <div className="flex items-end gap-1.5 h-28">
              {WEEKLY_LOAD.map((d) => {
                const pct = (d.load / maxLoad) * 100;
                const isHigh = d.load > 80;
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-sm relative" style={{ height: "80px" }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-sm transition-all ${isHigh ? "bg-amber-500/70" : "bg-cyan-500/50"}`}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-600">{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Flame size={15} className="text-red-400" />
              <h2 className="font-semibold text-white text-sm">Risk Alerts</h2>
            </div>
            <div className="space-y-3">
              {TEAM.filter((a) => a.risk !== "ready").map((athlete) => {
                const cfg = RISK_CONFIG[athlete.risk];
                return (
                  <div key={athlete.name} className="flex items-start gap-2.5">
                    <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
                    <div>
                      <div className="text-xs font-medium text-white">{athlete.name}</div>
                      <div className="text-[10px] text-slate-500 leading-relaxed">{athlete.riskNote}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
