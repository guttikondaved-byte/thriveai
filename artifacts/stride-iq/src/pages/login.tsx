import { useLocation } from "wouter";
import { Brain, ShieldCheck, LineChart, Activity, Bot } from "lucide-react";

const STATS = [
  { value: "Track",   label: "Every session",      color: "text-primary",      bg: "bg-primary/10 border-primary/25" },
  { value: "Monitor", label: "Injury risk",         color: "text-red-300",      bg: "bg-red-500/10 border-red-500/25" },
  { value: "Connect", label: "Athletes & coaches",  color: "text-[#F2D2CF]",    bg: "bg-[#F2D2CF]/10 border-[#F2D2CF]/25" },
];

const FEATURES = [
  { icon: <Brain className="w-5 h-5 text-[#F2D2CF]" />,    iconBg: "bg-[#F2D2CF]/15 border-[#F2D2CF]/20", title: "AveraAI Coach",      desc: "Ask anything — pace strategy, recovery, race prep. Your AI coach answers in seconds." },
  { icon: <ShieldCheck className="w-5 h-5 text-red-400" />, iconBg: "bg-red-500/15 border-red-500/20",      title: "Injury Risk Alerts", desc: "Thrive flags dangerous mileage spikes, low HRV, and early overtraining before it becomes an injury." },
  { icon: <Activity className="w-5 h-5 text-orange-400" />, iconBg: "bg-orange-500/15 border-orange-500/20", title: "Strava Auto-Sync",   desc: "Connect Strava once and every run appears in Thrive automatically — zero manual imports." },
  { icon: <LineChart className="w-5 h-5 text-primary" />,   iconBg: "bg-primary/15 border-primary/20",      title: "Training Plans",     desc: "Personalised plans built around your goal, fitness level, and schedule — updated as you progress." },
];

function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="w-full max-w-lg text-center relative">

      {/* Background glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div style={{ background: "radial-gradient(ellipse 60% 40% at 50% -10%, rgba(42,80,76,0.20) 0%, transparent 70%)" }} className="absolute inset-0" />
        <div style={{ background: "radial-gradient(ellipse 50% 35% at 90% 70%, rgba(242,210,207,0.08) 0%, transparent 70%)" }} className="absolute inset-0" />
      </div>

      {/* Logo + hero */}
      <div className="flex justify-center mb-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25"
          style={{ background: "#2A504C" }}>
          <img src="/logo.svg" alt="Thrive" className="w-10 h-10" />
        </div>
      </div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#A2AE98] bg-primary/15 border border-primary/30 px-3 py-1 rounded-full mb-5 shadow-sm shadow-primary/10">
        AI-powered running platform
      </div>
      <h1 className="text-4xl font-extrabold mb-3 tracking-tight leading-tight">
        <span className="text-white">Train smarter.</span><br />
        <span style={{ background: "linear-gradient(90deg, #A2AE98, #F2D2CF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
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
      <div className="mb-8 text-left rounded-2xl border border-primary/20 overflow-hidden">
        {/* Hero header */}
        <div className="px-6 pt-6 pb-5"
          style={{ background: "linear-gradient(135deg, rgba(42,80,76,0.15) 0%, rgba(42,80,76,0.05) 50%, rgba(6,7,14,0.0) 100%)" }}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-primary/25"
              style={{ background: "linear-gradient(135deg, rgba(42,80,76,0.40) 0%, rgba(61,122,116,0.25) 100%)", border: "1px solid rgba(42,80,76,0.5)" }}>
              <Bot className="w-7 h-7 text-[#A2AE98]" />
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
              { label: "Pace strategy",  c: "text-primary border-primary/30 bg-primary/10" },
              { label: "Race prep",      c: "text-[#A2AE98] border-[#A2AE98]/30 bg-[#A2AE98]/10" },
              { label: "Recovery",       c: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
              { label: "Injury Q&A",    c: "text-red-400 border-red-500/30 bg-red-500/10" },
              { label: "Training plans", c: "text-[#F2D2CF] border-[#F2D2CF]/30 bg-[#F2D2CF]/10" },
            ].map(t => (
              <span key={t.label} className={`text-[10px] px-2.5 py-1 rounded-full border font-medium ${t.c}`}>{t.label}</span>
            ))}
          </div>
        </div>

        {/* Chat preview */}
        <div className="px-5 pb-5 pt-4 space-y-3" style={{ background: "rgba(6,7,14,0.6)" }}>
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
                  style={{ background: "rgba(20,30,28,0.9)", border: "1px solid rgba(42,80,76,0.3)" }}>
                  {q}
                </div>
              </div>
              {/* Avera bubble */}
              <div className="flex items-end gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mb-0.5"
                  style={{ background: "linear-gradient(135deg, rgba(42,80,76,0.5), rgba(61,122,116,0.3))", border: "1px solid rgba(42,80,76,0.5)" }}>
                  <Bot className="w-3.5 h-3.5 text-[#A2AE98]" />
                </div>
                <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-xs text-[#F5F5F5] leading-relaxed"
                  style={{ background: "linear-gradient(135deg, rgba(42,80,76,0.12), rgba(61,122,116,0.06))", border: "1px solid rgba(42,80,76,0.25)" }}>
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
            style={{ background: "rgba(6,7,14,0.6)" }}>
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
    <div className="min-h-screen bg-[#06070E] flex items-center justify-center px-4 py-12">
      <div className="fixed top-4 right-5 z-50 flex items-center gap-2">
        <button onClick={() => navigate("/sign-up")}
          className="text-xs font-semibold text-muted-foreground hover:text-white px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 bg-[#06070E]/70 backdrop-blur-sm transition-all">
          Sign up
        </button>
        <button onClick={() => navigate("/sign-in")}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 hover:bg-primary/30 hover:border-primary/60 backdrop-blur-sm transition-all">
          Log in
        </button>
      </div>
      <Landing />
    </div>
  );
}
