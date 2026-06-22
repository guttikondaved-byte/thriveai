import { useState } from "react";
import { Zap, Eye, EyeOff, ChevronLeft, ChevronRight, Check, Brain, ShieldCheck, LineChart, MessageSquare, Users, Dumbbell, User, Activity, Bot, Upload, AlertCircle } from "lucide-react";

type View = "landing" | "athlete" | "coach" | "login";

// ── shared constants ────────────────────────────────────────────────────────

const FITNESS_LEVELS = [
  { value: "beginner",     label: "Beginner",     desc: "< 6 months running" },
  { value: "intermediate", label: "Intermediate",  desc: "1–3 years training" },
  { value: "advanced",     label: "Advanced",      desc: "3+ years, competitive" },
  { value: "elite",        label: "Elite",         desc: "Collegiate / post-collegiate" },
];

const ATHLETE_GOALS = [
  "Finish my first 5K", "Break 20 min in 5K", "Complete a half marathon",
  "Run a full marathon", "Improve race times", "Stay injury-free",
  "Build base mileage", "Qualify for Boston",
];

const COACHING_EXP = [
  { value: "new",         label: "New Coach",   desc: "< 1 year coaching" },
  { value: "developing",  label: "Developing",  desc: "1–3 years" },
  { value: "experienced", label: "Experienced", desc: "3–10 years" },
  { value: "veteran",     label: "Veteran",     desc: "10+ years" },
];

const COACH_FOCUSES = [
  "Cross Country", "Track & Field", "Road Racing", "Trail Running",
  "Youth Athletics", "Collegiate", "Masters / Adult", "Multi-sport",
];

const DATA_SOURCES = [
  { id: "strava",  icon: <Activity className="w-5 h-5" />, title: "Connect Strava",    badge: "Recommended", badgeColor: "text-[#FC4C02] border-[#FC4C02]/40 bg-transparent", desc: "Every run syncs automatically — no imports ever." },
  { id: "gpx",     icon: <Upload className="w-5 h-5" />, title: "Import GPX Files",   badge: "Free",            badgeColor: "text-primary border-primary/30 bg-transparent",    desc: "Export from Garmin, Apple Health, Coros, Polar, etc." },
  { id: "manual",  icon: <MessageSquare className="w-5 h-5" />, title: "Manual Logging",     badge: "Always available", badgeColor: "text-slate-400 border-slate-600/40 bg-transparent", desc: "Enter distance, duration, and effort by hand." },
];

// ── helpers ─────────────────────────────────────────────────────────────────

const input = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300 mb-1.5">{children}</label>;
}

function Error({ msg }: { msg?: string }) {
  return msg ? <p className="text-red-400 text-xs mt-1">{msg}</p> : null;
}

async function register(email: string, password: string, firstName: string, lastName: string): Promise<string | undefined> {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const res = await fetch("/api/auth/register", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (res.status === 409) {
    // Email already exists — try logging in with the same credentials
    const loginRes = await fetch("/api/auth/login", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) {
      throw new Error("This email is already registered. Check your password or use the Log in option.");
    }
    return undefined; // logged in via cookie, no sid to return
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
  return data.sid as string | undefined;
}

async function saveProfile(profile: Record<string, unknown>, sid?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sid) headers["Authorization"] = `Bearer ${sid}`;
  await fetch("/api/athlete/profile", {
    method: "PATCH", credentials: "include",
    headers,
    body: JSON.stringify(profile),
  });
}

// ── Step indicator ───────────────────────────────────────────────────────────

function Steps({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
              i < current ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.3)]" :
              i === current ? "border-2 border-primary text-primary bg-primary/10 shadow-[0_0_10px_rgba(var(--primary),0.1)]" :
              "border border-border text-muted-foreground bg-secondary/50"
            }`}>
              {i < current ? <Check size={11} /> : i + 1}
            </div>
            <span className={`text-xs font-semibold hidden sm:block ${i === current ? "text-foreground" : i < current ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
          </div>
          {i < labels.length - 1 && <div className={`h-px w-6 sm:w-10 ${i < current ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────────

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

function Landing({ onSelect }: { onSelect: (v: View) => void }) {
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

      {/* ── Thrive AI Section ─────────────────────────────────────── */}
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
        <button onClick={() => onSelect("athlete")}
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

        <button onClick={() => onSelect("coach")}
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

      <button onClick={() => onSelect("login")}
        className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
        Already have an account? <span className="underline underline-offset-2">Log in</span>
      </button>
    </div>
  );
}

// ── Athlete Sign-up ──────────────────────────────────────────────────────────

function AthleteSignup({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Account fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");

  // Profile fields
  const [age, setAge]                   = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("intermediate");
  const [goal, setGoal]                 = useState("");
  const [weeklyKm, setWeeklyKm]         = useState("");

  // Connect
  const [dataSource, setDataSource] = useState("strava");

  const steps = ["Account", "About You", "Connect"];

  function validateStep0() {
    if (!firstName.trim()) { setErr("First name is required"); return false; }
    if (!lastName.trim()) { setErr("Last name is required"); return false; }
    if (!email.includes("@")) { setErr("Enter a valid email"); return false; }
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return false; }
    return true;
  }

  function validateStep1() {
    if (!age || isNaN(Number(age)) || Number(age) < 10 || Number(age) > 100) { setErr("Enter a valid age (10–100)"); return false; }
    if (!weeklyKm || isNaN(Number(weeklyKm)) || Number(weeklyKm) <= 0) { setErr("Enter a weekly distance goal"); return false; }
    if (!goal) { setErr("Pick a training goal"); return false; }
    return true;
  }

  function next() {
    setErr("");
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step < 2) setStep(s => s + 1);
  }

  async function finish() {
    setErr("");
    setLoading(true);
    try {
      // Skip registration if already authenticated (e.g. returning after a previous attempt)
      const authCheck = await fetch("/api/auth/user", { credentials: "include" });
      const authData = authCheck.ok ? await authCheck.json() : { user: null };
      const alreadyLoggedIn = authData.user != null;
      let sid: string | undefined;
      if (!alreadyLoggedIn) {
        sid = await register(email, password, firstName, lastName);
      }
      await saveProfile({
        name: [firstName, lastName].filter(Boolean).join(" "),
        userRole: "athlete",
        ...(age ? { age: parseInt(age) } : {}),
        fitnessLevel,
        primaryGoal: goal,
        ...(weeklyKm ? { weeklyMileageGoal: parseFloat(weeklyKm) } : {}),
      }, sid);
      if (dataSource === "strava") {
        // Open in a new top-level tab — Strava blocks being loaded inside an iframe
        window.open("/api/strava/connect", "_blank", "noopener,noreferrer");
      }
      window.location.href = "/";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors">
        <ChevronLeft size={15} /> Back
      </button>

      <div className="flex items-center gap-2 mb-1">
        <User className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-medium text-white">Athlete Sign Up</h2>
      </div>
      <p className="text-slate-500 text-sm mb-6">Create your account and training profile.</p>

      <Steps current={step} labels={steps} />

      {/* Step 0: Account */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <input className={input} placeholder="Alex" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Last name</Label>
              <input className={input} placeholder="Johnson" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email address</Label>
            <input type="email" className={input} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} className={input + " pr-10"} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" tabIndex={-1}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: About You */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Age</Label>
              <input type="number" className={input} placeholder="17" min="10" max="100" value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div>
              <Label>Weekly goal (mi)</Label>
              <input type="number" className={input} placeholder="31" step="0.1" value={weeklyKm} onChange={e => setWeeklyKm(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Fitness level</Label>
            <div className="grid grid-cols-2 gap-2">
              {FITNESS_LEVELS.map(fl => (
                <button key={fl.value} type="button" onClick={() => setFitnessLevel(fl.value)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${fitnessLevel === fl.value ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700/60 bg-slate-800/30 hover:border-slate-600"}`}>
                  <p className={`text-sm font-semibold ${fitnessLevel === fl.value ? "text-cyan-400" : "text-white"}`}>{fl.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{fl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Training goal <span className="text-red-400">*</span></Label>
            <div className="flex flex-wrap gap-2">
              {ATHLETE_GOALS.map(g => (
                <button key={g} type="button" onClick={() => setGoal(g)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${goal === g ? "border-cyan-500 bg-cyan-500/15 text-cyan-300" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Connect */}
      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400 mb-4">How will you import your runs?</p>
          {DATA_SOURCES.map(src => (
            <button key={src.id} type="button" onClick={() => setDataSource(src.id)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all ${dataSource === src.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700/60 bg-slate-800/30 hover:border-slate-500"}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{src.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white">{src.title}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${src.badgeColor}`}>{src.badge}</span>
                  </div>
                  <p className="text-xs text-slate-500">{src.desc}</p>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${dataSource === src.id ? "border-cyan-500 bg-cyan-500" : "border-slate-600"}`}>
                  {dataSource === src.id && <Check size={9} className="text-slate-900" />}
                </div>
              </div>
            </button>
          ))}
          <p className="text-xs text-slate-600 text-center pt-1">You can change this anytime from the Activities page.</p>
        </div>
      )}

      {err && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm leading-snug">{err}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        {step > 0 ? (
          <button type="button" onClick={() => { setStep(s => s - 1); setErr(""); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
        ) : <div />}

        {step < 2 ? (
          <button type="button" onClick={next}
            className="flex items-center gap-2 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-xl text-sm transition-all">
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button type="button" onClick={finish} disabled={loading}
            className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-xl text-sm transition-all disabled:opacity-60 ${
              dataSource === "strava" ? "bg-[#FC4C02] hover:bg-[#e34400] text-white" : "bg-cyan-500 hover:bg-cyan-400 text-slate-900"
            }`}>
            {loading ? "Creating account…" : dataSource === "strava" ? "Connect Strava & finish" : "Create account"}
            {!loading && <Check size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Coach Sign-up ─────────────────────────────────────────────────────────────

function CoachSignup({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Account
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");

  // Profile
  const [teamName, setTeamName]     = useState("");
  const [coachExp, setCoachExp]     = useState("developing");
  const [athleteCount, setAthleteCount] = useState("");
  const [focus, setFocus]           = useState("");

  const steps = ["Account", "Your Coaching"];

  function validateStep0() {
    if (!firstName.trim()) { setErr("First name is required"); return false; }
    if (!lastName.trim()) { setErr("Last name is required"); return false; }
    if (!email.includes("@")) { setErr("Enter a valid email"); return false; }
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return false; }
    return true;
  }

  function validateStep1() {
    if (!teamName.trim()) { setErr("Team or club name is required"); return false; }
    if (!athleteCount || isNaN(Number(athleteCount)) || Number(athleteCount) < 1) { setErr("Enter the number of athletes you coach"); return false; }
    if (!focus) { setErr("Pick a coaching focus"); return false; }
    return true;
  }

  async function finish() {
    setErr("");
    if (!validateStep1()) return;
    setLoading(true);
    try {
      const authCheck = await fetch("/api/auth/user", { credentials: "include" });
      const authData = authCheck.ok ? await authCheck.json() : { user: null };
      const alreadyLoggedIn = authData.user != null;
      let sid: string | undefined;
      if (!alreadyLoggedIn) {
        sid = await register(email, password, firstName, lastName);
      }
      await saveProfile({
        name: [firstName, lastName].filter(Boolean).join(" "),
        userRole: "coach",
        primaryGoal: focus || "Coaching",
        fitnessLevel: "intermediate",
      }, sid);
      window.location.href = "/";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  function next() {
    setErr("");
    if (step === 0 && !validateStep0()) return;
    setStep(s => s + 1);
  }

  return (
    <div className="w-full max-w-sm">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors">
        <ChevronLeft size={15} /> Back
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Users className="w-5 h-5 text-slate-400" />
        <h2 className="text-lg font-medium text-white">Coach Sign Up</h2>
      </div>
      <p className="text-slate-500 text-sm mb-6">Set up your coaching portal and team tools.</p>

      <Steps current={step} labels={steps} />

      {/* Step 0: Account */}
      {step === 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <input className={input} placeholder="Taylor" value={firstName} onChange={e => setFirstName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Last name</Label>
              <input className={input} placeholder="Smith" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email address</Label>
            <input type="email" className={input} placeholder="coach@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <input type={showPw ? "text" : "password"} className={input + " pr-10"} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" tabIndex={-1}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Coaching Profile */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Team / Club name <span className="text-red-400">*</span></Label>
              <input className={input} placeholder="Westview Track & Field" value={teamName} onChange={e => setTeamName(e.target.value)} autoFocus />
            </div>
            <div className="col-span-2">
              <Label>Number of athletes</Label>
              <input type="number" min="1" className={input} placeholder="24" value={athleteCount} onChange={e => setAthleteCount(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Coaching experience</Label>
            <div className="grid grid-cols-2 gap-2">
              {COACHING_EXP.map(exp => (
                <button key={exp.value} type="button" onClick={() => setCoachExp(exp.value)}
                  className={`text-left p-3 rounded-xl border-2 transition-all ${coachExp === exp.value ? "border-violet-500 bg-violet-500/10" : "border-slate-700/60 bg-slate-800/30 hover:border-slate-600"}`}>
                  <p className={`text-sm font-semibold ${coachExp === exp.value ? "text-violet-300" : "text-white"}`}>{exp.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{exp.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Coaching focus</Label>
            <div className="flex flex-wrap gap-2">
              {COACH_FOCUSES.map(f => (
                <button key={f} type="button" onClick={() => setFocus(focus === f ? "" : f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${focus === f ? "border-violet-500 bg-violet-500/15 text-violet-300" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}>
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {err && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm leading-snug">{err}</p>
        </div>
      )}

      <div className="flex items-center justify-between mt-6">
        {step > 0 ? (
          <button type="button" onClick={() => { setStep(s => s - 1); setErr(""); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={15} /> Back
          </button>
        ) : <div />}

        {step < 1 ? (
          <button type="button" onClick={next}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl text-sm transition-all">
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button type="button" onClick={finish} disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-500 hover:bg-violet-400 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-60">
            {loading ? "Creating account…" : "Create account"}
            {!loading && <Check size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Log In ────────────────────────────────────────────────────────────────────

function LoginForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [err, setErr]         = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Login failed"); setLoading(false); return; }
      window.location.href = "/";
    } catch {
      setErr("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-6 transition-colors">
        <ChevronLeft size={15} /> Back
      </button>

      <div className="flex justify-center mb-5">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
          <Zap className="w-6 h-6 text-cyan-400" strokeWidth={2.5} />
        </div>
      </div>
      <h2 className="text-2xl font-bold text-white text-center mb-1">Welcome back</h2>
      <p className="text-slate-500 text-sm text-center mb-7">Log in to your Thrive account</p>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label>Email address</Label>
          <input type="email" className={input} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </div>
        <div>
          <Label>Password</Label>
          <div className="relative">
            <input type={showPw ? "text" : "password"} className={input + " pr-10"} placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" tabIndex={-1}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {err && (
          <div className="flex items-start gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm leading-snug">{err}</p>
          </div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-sm transition-colors disabled:opacity-60 mt-1">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-center text-xs text-slate-600 mt-5">
        No account?{" "}
        <button onClick={onBack} className="text-slate-400 hover:text-white underline underline-offset-2 transition-colors">
          Sign up here
        </button>
      </p>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Login() {
  const [view, setView] = useState<View>("landing");

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4 py-12">
      {view === "landing"  && <Landing onSelect={setView} />}
      {view === "athlete"  && <AthleteSignup onBack={() => setView("landing")} />}
      {view === "coach"    && <CoachSignup   onBack={() => setView("landing")} />}
      {view === "login"    && <LoginForm     onBack={() => setView("landing")} />}
    </div>
  );
}
