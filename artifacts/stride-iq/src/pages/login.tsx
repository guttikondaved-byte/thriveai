import { useLocation } from "wouter";
import { Brain, ShieldCheck, LineChart, MessageSquare, Users, Dumbbell, User, Activity, Bot, ChevronRight } from "lucide-react";

const basePath = import.meta.env.BASE_URL || "";

const STATS = [
  { value: "Track",   label: "Every session",      color: "text-cyan-300",   bg: "bg-cyan-500/10 border-cyan-500/25" },
  { value: "Monitor", label: "Injury risk",         color: "text-red-300",    bg: "bg-red-500/10 border-red-500/25" },
  { value: "Connect", label: "Athletes & coaches",  color: "text-violet-300", bg: "bg-violet-500/10 border-violet-500/25" },
];

const FEATURES = [
  { icon: <Brain className="w-5 h-5 text-violet-400" />,   iconBg: "bg-violet-500/15 border-violet-500/20", title: "AveraAI Coach",      desc: "Ask anything — pace strategy, recovery, race prep. Your AI coach answers in seconds." },
  { icon: <ShieldCheck className="w-5 h-5 text-red-400" />, iconBg: "bg-red-500/15 border-red-500/20",      title: "Injury Risk Alerts", desc: "Thrive flags dangerous mileage spikes, low HRV, and early overtraining before it becomes an injury." },
  { icon: <Activity className="w-5 h-5 text-orange-400" />, iconBg: "bg-orange-500/15 border-orange-500/20", title: "Strava Auto-Sync",   desc: "Connect Strava once and every run appears in Thrive automatically — zero manual imports." },
  { icon: <LineChart className="w-5 h-5 text-blue-400" />,  iconBg: "bg-blue-500/15 border-blue-500/20",    title: "Training Plans",     desc: "Personalised plans built around your goal, fitness level, and schedule — updated as you progress." },
];

function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="w-full max-w-lg text-center relative">

      {/* Background glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div style={{ background: "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(6,182,212,0.18) 0%, transparent 70%)" }} className="absolute inset-0" />
        <div style={{ background: "radial-gradient(ellipse 50% 35% at 10% 60%, rgba(139,92,246,0.12) 0%, transparent 70%)" }} className="absolute inset-0" />
        <div style={{ background: "radial-gradient(ellipse 40% 30% at 90% 70%, rgba(59,130,246,0.10) 0%, transparent 70%)" }} className="absolute inset-0" />
      </div>

      {/* Logo + hero */}
      <div className="flex justify-center mb-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'transparent' }}>
              <img src={`${window.location.origin}${basePath}/logo-mark.svg`} alt="Thrive" className="w-10 h-10" />
        </div>
      </div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 px-3 py-1 rounded-full mb-5 shadow-sm">
  <img src={`${window.location.origin}${basePath}/logo-mark.svg`} alt="Thrive" className="w-3 h-3" /> AI-powered running platform
      </div>
      <h1 className="text-4xl font-extrabold mb-3 tracking-tight leading-tight">
        <span className="text-white">Train smarter.</span><br />
        <span style={{ background: "linear-gradient(90deg, #22d3ee, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Stay injury-free.
        </span>
      </h1>
      <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
        Thrive combines real training data, AI coaching, and injury detection to help runners and coaches get the most out of every session.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {STATS.map(s => (
          <div key={s.label} className={`rounded-xl border py-4 px-2 ${s.bg}`}>
            <p className={`text-xl font-extrabold mb-0.5 ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* AveraAI Section */}
      <div className="mb-8 text-left rounded-2xl border border-cyan-500/20 overflow-hidden">
        {/* Hero header */}
        <div className="px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.08) 50%, rgba(15,23,42,0.0) 100%)" }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/25"
              style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.35) 0%, rgba(59,130,246,0.25) 100%)", border: "1px solid rgba(6,182,212,0.4)" }}>
              <Bot className="w-7 h-7 text-cyan-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-base font-bold text-white">AveraAI</p>
              </div>
              <p className="text-xs text-slate-400">Your AI running coach, always available</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "Pace strategy", c: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
              { label: "Race prep",     c: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
              { label: "Recovery",      c: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
              { label: "Injury Q&A",   c: "text-red-400 border-red-500/30 bg-red-500/10" },
              { label: "Training plans", c: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
            ].map(t => (
              <span key={t.label} className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${t.c}`}>{t.label}</span>
            ))}
          </div>
        </div>

        {/* Chat preview */}
        <div className="px-5 pb-5 pt-4 space-y-3" style={{ background: "rgba(10,15,30,0.6)" }}>
          {[
            {
              q: "Am I ready to race this weekend?",
              a: "Based on your last 7 days — 42 mi with solid HRV — you're in good shape. Taper today and you'll peak on race day. 🏁",
            },
            {
              q: "My knee hurts after long runs.",
              a: "Looks like you jumped mileage +23% last week. Could be early ITB irritation. I'd cut volume 15% this week and add hip strengthening — I can build you a recovery plan.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="space-y-2">
              {/* User bubble */}
              <div className="flex justify-end">
                <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tr-sm text-xs text-white"
                  style={{ background: "rgba(30,41,59,0.9)", border: "1px solid rgba(51,65,85,0.6)" }}>
                  {q}
                </div>
              </div>
              {/* Avera bubble */}
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5"
                  style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.4), rgba(59,130,246,0.3))", border: "1px solid rgba(6,182,212,0.35)" }}>
                  <Bot className="w-3.5 h-3.5 text-cyan-300" />
                </div>
                <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-xs text-cyan-100 leading-relaxed"
                  style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(59,130,246,0.08))", border: "1px solid rgba(6,182,212,0.2)" }}>
                  {a}
                </div>
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-600 text-center pt-1">Powered by your real training data</p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-2 gap-3 mb-8 text-left">
        {FEATURES.map(f => (
          <div key={f.title} className="rounded-xl border border-slate-700/50 p-4 hover:border-slate-600/70 transition-colors"
            style={{ background: "rgba(15,23,42,0.6)" }}>
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-3 ${f.iconBg}`}>{f.icon}</div>
            <p className="text-sm font-semibold text-white mb-1">{f.title}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 py-12">
      <div className="fixed top-4 right-5 z-50 flex items-center gap-2">
        <button onClick={() => navigate("/sign-up")}
          className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-500 bg-slate-900/70 backdrop-blur-sm transition-all">
          Sign up
        </button>
        <button onClick={() => navigate("/sign-in")}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 hover:border-cyan-400/60 backdrop-blur-sm transition-all">
          Log in
        </button>
      </div>
      <Landing />
    </div>
  );
}
