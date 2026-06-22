import { useLocation } from "wouter";
import { Zap, Brain, ShieldCheck, LineChart, MessageSquare, Users, Dumbbell, User, Activity, Bot, ChevronRight } from "lucide-react";

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
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25"
          style={{ background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)" }}>
          <Zap className="w-8 h-8 text-white" strokeWidth={2.5} fill="white" />
        </div>
      </div>
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-400/30 px-3 py-1 rounded-full mb-5 shadow-sm shadow-cyan-500/10">
        <Zap size={10} fill="currentColor" /> AI-powered running platform
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

      {/* Thrive AI Section */}
      <div className="mb-8 text-left rounded-2xl border border-cyan-500/20 overflow-hidden"
        style={{ background: "linear-gradient(160deg, rgba(6,182,212,0.06) 0%, rgba(15,23,42,0.95) 40%)" }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-800/60">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-cyan-500">Powered by Thrive AI</span>
          </div>
          <h2 className="text-lg font-bold text-white leading-tight">
            Your AI coach. <span className="text-cyan-400">Always on.</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Thrive AI learns from your training data to give personalised coaching, catch injury risk early, and build plans that adapt as you grow.
          </p>
        </div>

        {/* Meet AveraAI */}
        <div className="px-5 py-4 border-b border-slate-800/60">
          <p className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest mb-3">Meet AveraAI</p>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20"
              style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.3) 0%, rgba(59,130,246,0.2) 100%)", border: "1px solid rgba(6,182,212,0.35)" }}>
              <Bot className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AveraAI</p>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                Your always-available AI running coach. Ask about pace strategy, recovery windows, race-day nutrition, or "why do my legs feel heavy?" — Avera answers in seconds, powered by your real training data.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {[
                  { label: "Pace strategy", c: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" },
                  { label: "Race prep",     c: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
                  { label: "Recovery",      c: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
                  { label: "Injury Q&A",   c: "text-red-400 border-red-500/30 bg-red-500/10" },
                  { label: "Plan reviews", c: "text-violet-400 border-violet-500/30 bg-violet-500/10" },
                ].map(t => (
                  <span key={t.label} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${t.c}`}>{t.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI Capabilities grid */}
        <div className="px-5 py-4 border-b border-slate-800/60">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">What Thrive AI does</p>
          <div className="space-y-3">
            {[
              { Icon: ShieldCheck, color: "text-red-400",    bg: "bg-red-500/15 border-red-400/30",       title: "Injury Risk Detection",      desc: "Flags mileage spikes, HRV dips, and overtraining patterns before they cause an injury." },
              { Icon: Dumbbell,    color: "text-amber-400",  bg: "bg-amber-500/15 border-amber-400/30",   title: "Adaptive Training Plans",    desc: "AI builds week-by-week plans around your goal, fitness level, and real progress." },
              { Icon: LineChart,   color: "text-blue-400",   bg: "bg-blue-500/15 border-blue-400/30",     title: "Load & Recovery Monitoring", desc: "Tracks cumulative fatigue vs. fitness to tell you when to push and when to rest." },
              { Icon: Users,       color: "text-violet-400", bg: "bg-violet-500/15 border-violet-400/30", title: "Coach Intelligence",          desc: "Coaches get AI-powered roster summaries, per-athlete risk flags, and team-wide insights." },
            ].map(({ Icon, color, bg, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat preview strip */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Example conversations</p>
          <div className="space-y-2">
            {[
              { q: "Am I ready to race this weekend?", a: "Based on your last 7 days — 42 mi with solid HRV — you're in good shape. Taper today and you'll peak on race day." },
              { q: "My knee hurts after long runs.", a: "Could be ITB tightness from your mileage jump last week (+23%). I'd suggest dropping volume 15% and adding hip strengthening." },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-slate-700/50 p-3 space-y-2"
                style={{ background: "rgba(15,23,42,0.7)" }}>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-slate-700/80 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-2.5 h-2.5 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-300 italic">"{q}"</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-2.5 h-2.5 text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-cyan-300 leading-relaxed">{a}</p>
                </div>
              </div>
            ))}
          </div>
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

      {/* Role picker */}
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Get started — I am a…</p>

      <div className="space-y-3 mb-6">
        <button onClick={() => navigate("/sign-up?role=athlete")}
          className="w-full text-left rounded-2xl border border-cyan-500/40 p-5 transition-all group hover:border-cyan-400/70 hover:shadow-lg hover:shadow-cyan-500/10"
          style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.03) 100%)" }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-cyan-500/20"
              style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.25) 0%, rgba(59,130,246,0.15) 100%)", border: "1px solid rgba(6,182,212,0.4)" }}>
              <User className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors">Student Athlete</p>
              <p className="text-xs text-slate-500 mt-0.5">Track training · AI coach · Injury alerts · Training plans</p>
            </div>
            <ChevronRight size={16} className="text-cyan-500/60 group-hover:text-cyan-400 transition-colors" />
          </div>
        </button>

        <button onClick={() => navigate("/sign-up?role=coach")}
          className="w-full text-left rounded-2xl border border-violet-500/40 p-5 transition-all group hover:border-violet-400/70 hover:shadow-lg hover:shadow-violet-500/10"
          style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.03) 100%)" }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-violet-500/20"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.25) 0%, rgba(99,102,241,0.15) 100%)", border: "1px solid rgba(139,92,246,0.4)" }}>
              <Users className="w-5 h-5 text-violet-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white group-hover:text-violet-200 transition-colors">Coach</p>
              <p className="text-xs text-slate-500 mt-0.5">Team roster · Workload monitoring · Risk dashboard · Alerts</p>
            </div>
            <ChevronRight size={16} className="text-violet-500/60 group-hover:text-violet-400 transition-colors" />
          </div>
        </button>
      </div>

      <button onClick={() => navigate("/sign-in")}
        className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
        Already have an account? <span className="underline underline-offset-2">Log in</span>
      </button>
    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 py-12">
      <div className="fixed top-4 right-5 z-50 flex items-center gap-2">
        <button onClick={() => navigate("/sign-up")}
          className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700/60 hover:border-slate-500 bg-slate-900/70 backdrop-blur-sm transition-all" >
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
