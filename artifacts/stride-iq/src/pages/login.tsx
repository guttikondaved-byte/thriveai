import { useAuth } from "@workspace/replit-auth-web";
import { Zap, Check } from "lucide-react";

const ROLES = [
  {
    emoji: "🏃",
    label: "Student Athlete",
    desc: "Track your training, catch injury risk early, and get a personalised AI coach.",
    features: [
      "Personal dashboard & activity log",
      "AI coach AveraAI",
      "Injury risk alerts",
      "Custom training plans",
      "Strava auto-sync",
    ],
    accent: "cyan",
  },
  {
    emoji: "📋",
    label: "Coach",
    desc: "Monitor your whole team's workload and health from one portal.",
    features: [
      "Team roster & risk dashboard",
      "Athlete workload monitoring",
      "Team-wide alerts",
      "Load analytics",
      "Strava connection status",
    ],
    accent: "violet",
  },
];

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
            <Zap size={16} className="text-cyan-400" strokeWidth={2.5} />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Thrive</span>
        </div>
        <button
          onClick={login}
          className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-slate-800/60"
        >
          Log in
        </button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-full mb-6">
          <Zap size={11} fill="currentColor" />
          AI-powered running coach
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight tracking-tight">
          Train smarter.<br />
          <span className="text-cyan-400">Stay injury-free.</span>
        </h1>
        <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto mb-10 leading-relaxed">
          Thrive gives athletes and coaches the AI tools to build stronger, safer training — powered by real data.
        </p>

        <button
          onClick={login}
          className="px-8 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-sm transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 mb-4"
        >
          Get started — it's free
        </button>
        <p className="text-xs text-slate-600">
          Already have an account?{" "}
          <button onClick={login} className="text-slate-400 hover:text-white underline underline-offset-2 transition-colors">
            Log in here
          </button>
        </p>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-14 max-w-2xl w-full text-left">
          {ROLES.map(role => (
            <div
              key={role.label}
              className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-6"
            >
              <div className="text-3xl mb-3">{role.emoji}</div>
              <h2 className="text-base font-bold text-white mb-1">{role.label}</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">{role.desc}</p>
              <ul className="space-y-1.5">
                {role.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check size={13} className="text-cyan-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center text-xs text-slate-700 py-6">
        © {new Date().getFullYear()} Thrive · Built for serious runners
      </footer>
    </div>
  );
}
