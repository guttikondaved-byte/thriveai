import { useState } from "react";
import { Zap, Eye, EyeOff, ChevronLeft, ChevronRight, Check } from "lucide-react";

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
  { id: "strava",  icon: "🟠", title: "Connect Strava",    badge: "⚡ Recommended", badgeColor: "text-[#FC4C02] border-[#FC4C02]/40 bg-[#FC4C02]/10", desc: "Every run syncs automatically — no imports ever." },
  { id: "gpx",    icon: "📁", title: "Import GPX Files",   badge: "Free",            badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",    desc: "Export from Garmin, Apple Health, Coros, Polar, etc." },
  { id: "manual", icon: "✏️", title: "Manual Logging",     badge: "Always available", badgeColor: "text-slate-400 border-slate-600/40 bg-slate-700/30", desc: "Enter distance, duration, and effort by hand." },
];

// ── helpers ─────────────────────────────────────────────────────────────────

const input = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300 mb-1.5">{children}</label>;
}

function Error({ msg }: { msg?: string }) {
  return msg ? <p className="text-red-400 text-xs mt-1">{msg}</p> : null;
}

async function register(email: string, password: string, firstName: string, lastName: string) {
  const name = [firstName, lastName].filter(Boolean).join(" ");
  const res = await fetch("/api/auth/register", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Registration failed");
}

async function saveProfile(profile: Record<string, unknown>) {
  await fetch("/api/athlete/profile", {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
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
              i < current ? "bg-cyan-500 text-slate-900" :
              i === current ? "border-2 border-cyan-500 text-cyan-400 bg-cyan-500/10" :
              "border border-slate-700 text-slate-600 bg-slate-800"
            }`}>
              {i < current ? <Check size={11} /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? "text-white" : i < current ? "text-cyan-400" : "text-slate-600"}`}>{label}</span>
          </div>
          {i < labels.length - 1 && <div className={`h-px w-6 sm:w-10 ${i < current ? "bg-cyan-500" : "bg-slate-700"}`} />}
        </div>
      ))}
    </div>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────────

function Landing({ onSelect }: { onSelect: (v: View) => void }) {
  return (
    <div className="w-full max-w-sm text-center">
      <div className="flex justify-center mb-5">
        <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
          <Zap className="w-7 h-7 text-cyan-400" strokeWidth={2.5} />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-white mb-1.5 tracking-tight">Thrive</h1>
      <p className="text-slate-400 text-sm mb-8">AI-powered training for serious athletes</p>

      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">I am a…</p>

      <div className="space-y-3 mb-6">
        <button onClick={() => onSelect("athlete")}
          className="w-full text-left rounded-xl border-2 border-slate-700/60 bg-slate-800/30 hover:border-cyan-500/60 hover:bg-cyan-500/5 p-5 transition-all group">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🏃</span>
            <div className="flex-1">
              <p className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">Student Athlete</p>
              <p className="text-xs text-slate-500 mt-0.5">Track training · AI coach · Injury alerts</p>
            </div>
            <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
          </div>
        </button>

        <button onClick={() => onSelect("coach")}
          className="w-full text-left rounded-xl border-2 border-slate-700/60 bg-slate-800/30 hover:border-violet-500/60 hover:bg-violet-500/5 p-5 transition-all group">
          <div className="flex items-center gap-4">
            <span className="text-3xl">📋</span>
            <div className="flex-1">
              <p className="text-base font-bold text-white group-hover:text-violet-300 transition-colors">Coach</p>
              <p className="text-xs text-slate-500 mt-0.5">Team roster · Workload monitoring · Alerts</p>
            </div>
            <ChevronRight size={16} className="text-slate-600 group-hover:text-violet-400 transition-colors" />
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
    if (!email.includes("@")) { setErr("Enter a valid email"); return false; }
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return false; }
    return true;
  }

  function validateStep1() {
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
      await register(email, password, firstName, lastName);
      await saveProfile({
        name: [firstName, lastName].filter(Boolean).join(" "),
        userRole: "athlete",
        ...(age ? { age: parseInt(age) } : {}),
        fitnessLevel,
        primaryGoal: goal,
        ...(weeklyKm ? { weeklyMileageGoal: parseFloat(weeklyKm) } : {}),
      });
      if (dataSource === "strava") {
        window.location.href = "/api/strava/connect";
      } else {
        window.location.href = "/";
      }
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
        <span className="text-2xl">🏃</span>
        <h2 className="text-xl font-bold text-white">Athlete Sign Up</h2>
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
              <Label>Age (optional)</Label>
              <input type="number" className={input} placeholder="17" min="10" max="100" value={age} onChange={e => setAge(e.target.value)} />
            </div>
            <div>
              <Label>Weekly distance goal (km)</Label>
              <input type="number" className={input} placeholder="50" step="0.1" value={weeklyKm} onChange={e => setWeeklyKm(e.target.value)} />
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

      {err && <p className="text-red-400 text-xs mt-3">{err}</p>}

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
    if (!email.includes("@")) { setErr("Enter a valid email"); return false; }
    if (password.length < 8) { setErr("Password must be at least 8 characters"); return false; }
    return true;
  }

  function validateStep1() {
    if (!teamName.trim()) { setErr("Team or club name is required"); return false; }
    return true;
  }

  async function finish() {
    setErr("");
    if (!validateStep1()) return;
    setLoading(true);
    try {
      await register(email, password, firstName, lastName);
      await saveProfile({
        name: [firstName, lastName].filter(Boolean).join(" "),
        userRole: "coach",
        primaryGoal: focus || "Coaching",
        fitnessLevel: "intermediate",
      });
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
        <span className="text-2xl">📋</span>
        <h2 className="text-xl font-bold text-white">Coach Sign Up</h2>
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
              <Label>Number of athletes (optional)</Label>
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
            <Label>Coaching focus (optional)</Label>
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

      {err && <p className="text-red-400 text-xs mt-3">{err}</p>}

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

        {err && <p className="text-red-400 text-xs">{err}</p>}

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
