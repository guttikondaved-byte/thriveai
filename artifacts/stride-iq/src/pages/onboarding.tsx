import { useState } from "react";
import { useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Check, Upload, Users, User, LayoutDashboard, ShieldAlert, Bot, TrendingUp, Activity, Sparkles } from "lucide-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type Role = "athlete" | "coach";
type FitnessLevel = "beginner" | "intermediate" | "advanced" | "elite";
type CoachExp = "new" | "developing" | "experienced" | "veteran";
interface FormData {
  role: Role | null;
  name: string;
  age: string;
  country: string;
  state: string;
  fitnessLevel: FitnessLevel;
  primaryGoal: string;
  weeklyMileageGoal: string;
  teamName: string;
  coachingExp: CoachExp | null;
  athleteCount: string;
  coachFocus: string;
  dataSource: "strava" | "gpx" | "manual" | null;
  plan: "free" | "pro";
}

// Step indices for each role
// Athlete: 0 = Role, 1 = About You, 2 = Connect Data, 3 = Choose Plan
// Coach:   0 = Role, 1 = Your Profile, 2 = Get Started
const ATHLETE_STEPS = ["Your Role", "About You", "Connect Data", "Choose Plan"];
const COACH_STEPS   = ["Your Role", "Your Profile", "Get Started"];

const FITNESS_LEVELS: { value: FitnessLevel; label: string; desc: string }[] = [
  { value: "beginner",     label: "Beginner",     desc: "Running < 6 months" },
  { value: "intermediate", label: "Intermediate",  desc: "1–3 years training" },
  { value: "advanced",     label: "Advanced",      desc: "3+ years, competitive" },
  { value: "elite",        label: "Elite",         desc: "Collegiate / post-collegiate" },
];

const ATHLETE_GOALS = [
  "Finish my first 5K",
  "Break 20 min in 5K",
  "Complete a half marathon",
  "Run a full marathon",
  "Improve race times",
  "Stay injury-free",
  "Build base mileage",
];

const COACHING_EXP: { value: CoachExp; label: string; desc: string }[] = [
  { value: "new",         label: "New Coach",     desc: "< 1 year coaching" },
  { value: "developing",  label: "Developing",    desc: "1–3 years" },
  { value: "experienced", label: "Experienced",   desc: "3–10 years" },
  { value: "veteran",     label: "Veteran",       desc: "10+ years" },
];

const COACH_FOCUSES = [
  "Cross Country", "Track & Field", "Road Racing", "Trail Running",
  "Youth Athletics", "Collegiate", "Masters / Adult", "Multi-sport",
];

const DATA_SOURCES = [
  {
    id: "strava" as const,
    Icon: Activity,
    title: "Connect Strava",
    subtitle: "Import your runs in one tap",
    desc: "Sync your runs from Strava whenever you like. Upgrade to Pro for automatic real-time sync — no manual imports ever.",
    badge: "Recommended",
    badgeColor: "bg-transparent text-[#FC4C02] border-[#FC4C02]/30",
  },
  {
    id: "gpx" as const,
    Icon: Upload,
    title: "Import GPX Files",
    subtitle: "Works with every GPS watch",
    desc: "Export a .gpx file from Garmin Connect, Apple Health, Coros, Polar, or any GPS watch.",
    badge: "Free",
    badgeColor: "bg-transparent text-primary border-primary/30",
  },
  {
    id: "manual" as const,
    Icon: Check,
    title: "Manual Logging",
    subtitle: "Log runs by hand",
    desc: "Enter distance, duration, heart rate, and effort directly, no GPS required.",
    badge: "Always available",
    badgeColor: "bg-transparent text-muted-foreground border-border/40",
  },
];

function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-3 mb-12">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < step  ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.3)]" :
                i === step ? "bg-primary/10 border-2 border-primary text-primary shadow-[0_0_10px_rgba(var(--primary),0.1)]" :
                "bg-secondary/50 border border-border text-muted-foreground"}`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-sm font-semibold hidden sm:block
              ${i === step ? "text-foreground" : i < step ? "text-primary" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-14 h-px ${i < step ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const inputCls = (error?: string) =>
  `w-full bg-card/80 border rounded-lg px-4 py-2.5 text-foreground placeholder-muted-foreground/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition ${
    error ? "border-red-500" : "border-border focus:border-primary"
  }`;

export default function Onboarding({ onDone }: { onDone?: () => void } = {}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => {
    const stored = sessionStorage.getItem("thrive_pending_role");
    const pendingRole = stored === "athlete" || stored === "coach" ? stored : null;
    if (pendingRole) sessionStorage.removeItem("thrive_pending_role");
    return {
      role: pendingRole,
      name: "", age: "",
      country: "", state: "",
      fitnessLevel: "intermediate",
      primaryGoal: "",
      weeklyMileageGoal: "",
      teamName: "",
      coachingExp: null,
      athleteCount: "",
      coachFocus: "",
      dataSource: null,
      plan: "free",
    };
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [, navigate] = useLocation();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();

  const steps = form.role === "coach" ? COACH_STEPS : ATHLETE_STEPS;

  function handleBack() {
    // Mid-onboarding: step back one screen.
    if (step > 0) {
      setStep(s => Math.max(0, s - 1));
      return;
    }

    // First step: there's nowhere to go *inside* the app. The user is signed in
    // without a role, and AppContent force-redirects role-less users straight
    // back into onboarding — so any in-app navigation just loops here. The only
    // real "back" is to sign out and return to the sign-in screen.
    signOut({ redirectUrl: `${window.location.origin}${basePath}/sign-in` });
  }

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  // Step 0: Role selection
  function validateStep0() {
    if (!form.role) { setErrors({ role: "Please select a role to continue" }); return false; }
    return true;
  }

  // Step 1: About you (athlete)
  function validateStep1Athlete() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.age) e.age = "Age is required";
    else if (isNaN(Number(form.age)) || Number(form.age) < 10 || Number(form.age) > 99)
      e.age = "Enter a valid age (10–99)";
    if (!form.country.trim()) e.country = "Country is required";
    if (!form.state.trim()) e.state = "State / region is required";
    if (!form.weeklyMileageGoal) e.weeklyMileageGoal = "Weekly goal is required";
    if (!form.primaryGoal) e.primaryGoal = "Select or type a goal";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Step 1: Coach profile
  function validateStep1Coach() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.teamName.trim()) e.teamName = "Team name is required";
    if (!form.country.trim()) e.country = "Country is required";
    if (!form.state.trim()) e.state = "State / region is required";
    if (!form.athleteCount) e.athleteCount = "Number of athletes is required";
    if (!form.coachingExp) e.coachingExp = "Select your experience level";
    if (!form.coachFocus) e.coachFocus = "Select a coaching focus";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1) {
      if (form.role === "athlete" && !validateStep1Athlete()) return;
      if (form.role === "coach"   && !validateStep1Coach())   return;
    }
    setStep(s => s + 1);
  }

  async function finish() {
    const isCoach = form.role === "coach";
    await updateProfile.mutateAsync({
      data: {
        name: form.name.trim() || (isCoach ? "Coach" : "Athlete"),
        ...(form.age ? { age: parseInt(form.age) } : {}),
        ...(form.country.trim() ? { country: form.country.trim() } : {}),
        ...(form.state.trim() ? { state: form.state.trim() } : {}),
        userRole: form.role!,
        ...(isCoach
          ? {
              primaryGoal: form.coachFocus || "Coaching",
              fitnessLevel: "intermediate",
            }
          : {
              fitnessLevel: form.fitnessLevel,
              primaryGoal: form.primaryGoal,
              ...(form.weeklyMileageGoal ? { weeklyMileageGoal: parseFloat(form.weeklyMileageGoal) } : {}),
            }),
      },
    });
    // Wait for the profile to actually refetch (not just mark stale) before
    // navigating — otherwise AppContent sees the old role and redirects back.
    await qc.refetchQueries({ queryKey: getGetAthleteProfileQueryKey() });
    // Coaches get a team auto-created from the name they entered during onboarding,
    // so they land on the dashboard with a ready-to-share invite code instead of an
    // empty state. The role was just persisted above, so the server's coach check passes.
    if (isCoach && form.teamName.trim()) {
      try {
        await fetch("/api/teams", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.teamName.trim() }),
        });
      } catch {
        // Non-fatal — the coach can still create a team from the Team page.
      }
    }
    // If athlete chose Strava, kick off OAuth before landing on dashboard
    if (form.dataSource === "strava") {
      window.open("/api/strava/connect", "_blank", "noopener,noreferrer");
    }

    // Athlete picked Pro: send them straight to Stripe Checkout instead of the
    // dashboard. Free stays exactly as before — no payment step at all.
    if (!isCoach && form.plan === "pro") {
      setStartingCheckout(true);
      try {
        const res = await fetch("/api/stripe/checkout-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planType: "athlete", fromOnboarding: true }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.url) {
          window.location.href = data.url as string;
          return;
        }
      } catch {
        // Fall through to the free dashboard — they can upgrade from Profile any time.
      }
      setStartingCheckout(false);
    }

    onDone?.();
    navigate("/");
  }

  const isLastStep = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl relative pt-10">
        <button
          type="button"
          onClick={handleBack}
          className="absolute left-0 top-0 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <img src="/logo.svg" alt="Thrive" className="h-8 w-auto" />
        </div>

        <StepIndicator step={step} steps={steps} />

        {/* ── Step 0: Role Selection ── */}
        {step === 0 && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">Welcome to Thrive</h1>
              <p className="text-muted-foreground">Tell us how you'll be using the platform.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: "athlete" as Role,
                  Icon: User,
                  label: "Athlete",
                  desc: "I want to track my own training, monitor injury risk, and get personalised AI coaching.",
                  features: ["Personal dashboard & activity log", "AI coach AveraAI", "Injury risk alerts", "Custom training plans"],
                },
                {
                  id: "coach" as Role,
                  Icon: Users,
                  label: "Coach",
                  desc: "I manage a team or group of athletes and want to monitor their workload and health.",
                  features: ["Team roster & risk dashboard", "Athlete workload monitoring", "Team-wide alerts", "Load analytics"],
                },
              ].map(role => {
                const selected = form.role === role.id;
                return (
                  <button
                    key={role.id}
                    onClick={() => { set("role", role.id); setErrors({}); }}
                    className={`relative text-left rounded-xl border p-6 transition-all duration-200
                      ${selected
                        ? "border-primary bg-primary/5 shadow-sm scale-[1.01]"
                        : "border-border bg-card/50 hover:border-primary/40 hover:bg-card"}`}
                  >
                    {selected && (
                      <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check size={12} className="text-[#F5F5F5]" />
                      </div>
                    )}
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                        <role.Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <h2 className="text-lg font-medium text-foreground">{role.label}</h2>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">{role.desc}</p>
                    <ul className="space-y-1.5">
                      {role.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            {errors.role && <p className="text-red-600 text-xs mt-3 text-center">{errors.role}</p>}
          </div>
        )}

        {/* ── Step 1 (Athlete): About You ── */}
        {step === 1 && form.role === "athlete" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Tell us about yourself</h1>
              <p className="text-muted-foreground">We'll personalise your training and AI coaching based on this.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name <span className="text-red-600">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Alex Johnson"
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Age <span className="text-red-600">*</span></label>
                <input
                  type="number" value={form.age} onChange={e => set("age", e.target.value)}
                  placeholder="17"
                  className={inputCls(errors.age)}
                />
                {errors.age && <p className="text-red-600 text-xs mt-1">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Weekly Distance Goal (mi) <span className="text-red-600">*</span></label>
                <input
                  type="number" step="0.1" value={form.weeklyMileageGoal} onChange={e => set("weeklyMileageGoal", e.target.value)}
                  placeholder="50"
                  className={inputCls(errors.weeklyMileageGoal)}
                />
                {errors.weeklyMileageGoal && <p className="text-red-600 text-xs mt-1">{errors.weeklyMileageGoal}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Country <span className="text-red-600">*</span></label>
                <input
                  value={form.country} onChange={e => set("country", e.target.value)}
                  placeholder="United States"
                  className={inputCls(errors.country)}
                />
                {errors.country && <p className="text-red-600 text-xs mt-1">{errors.country}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">State / Region <span className="text-red-600">*</span></label>
                <input
                  value={form.state} onChange={e => set("state", e.target.value)}
                  placeholder="California"
                  className={inputCls(errors.state)}
                />
                {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Fitness Level</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {FITNESS_LEVELS.map(fl => (
                  <button key={fl.value} onClick={() => set("fitnessLevel", fl.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all
                      ${form.fitnessLevel === fl.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 bg-card/40"}`}
                  >
                    <p className={`text-sm font-semibold ${form.fitnessLevel === fl.value ? "text-primary" : "text-foreground"}`}>{fl.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{fl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Primary Goal <span className="text-red-600">*</span></label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {ATHLETE_GOALS.map(g => (
                  <button key={g} onClick={() => set("primaryGoal", g)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all
                      ${form.primaryGoal === g
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <input
                value={ATHLETE_GOALS.includes(form.primaryGoal) ? "" : form.primaryGoal}
                onChange={e => set("primaryGoal", e.target.value)}
                placeholder="Or type your own goal…"
                className={inputCls(errors.primaryGoal)}
              />
              {errors.primaryGoal && <p className="text-red-600 text-xs mt-1">{errors.primaryGoal}</p>}
            </div>
          </div>
        )}

        {/* ── Step 1 (Coach): Your Profile ── */}
        {step === 1 && form.role === "coach" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Tell us about your coaching</h1>
              <p className="text-muted-foreground">We'll customise your coach portal and team tools.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Your Name <span className="text-red-600">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Coach Taylor"
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-red-600 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Team / Club Name <span className="text-red-600">*</span></label>
                <input
                  value={form.teamName}
                  onChange={e => set("teamName", e.target.value)}
                  placeholder="Westview Track & Field"
                  className={inputCls(errors.teamName)}
                />
                {errors.teamName && <p className="text-red-600 text-xs mt-1">{errors.teamName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Number of Athletes <span className="text-red-600">*</span></label>
                <input
                  type="number" min="1" value={form.athleteCount}
                  onChange={e => set("athleteCount", e.target.value)}
                  placeholder="24"
                  className={inputCls(errors.athleteCount)}
                />
                <p className="text-xs text-muted-foreground mt-1">An estimate is okay. You can update this later.</p>
                {errors.athleteCount && <p className="text-red-600 text-xs mt-1">{errors.athleteCount}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Country <span className="text-red-600">*</span></label>
                <input
                  value={form.country} onChange={e => set("country", e.target.value)}
                  placeholder="United States"
                  className={inputCls(errors.country)}
                />
                {errors.country && <p className="text-red-600 text-xs mt-1">{errors.country}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">State / Region <span className="text-red-600">*</span></label>
                <input
                  value={form.state} onChange={e => set("state", e.target.value)}
                  placeholder="California"
                  className={inputCls(errors.state)}
                />
                {errors.state && <p className="text-red-600 text-xs mt-1">{errors.state}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Coaching Experience <span className="text-red-600">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COACHING_EXP.map(exp => (
                  <button key={exp.value} onClick={() => set("coachingExp", exp.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all
                      ${form.coachingExp === exp.value
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 bg-card/40"}`}
                  >
                    <p className={`text-sm font-semibold ${form.coachingExp === exp.value ? "text-primary" : "text-foreground"}`}>{exp.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{exp.desc}</p>
                  </button>
                ))}
              </div>
              {errors.coachingExp && <p className="text-red-600 text-xs mt-2">{errors.coachingExp}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Coaching Focus <span className="text-red-600">*</span></label>
              <div className="flex flex-wrap gap-2">
                {COACH_FOCUSES.map(f => (
                  <button key={f} onClick={() => set("coachFocus", form.coachFocus === f ? "" : f)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all
                      ${form.coachFocus === f
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {errors.coachFocus && <p className="text-red-600 text-xs mt-2">{errors.coachFocus}</p>}
            </div>
          </div>
        )}

        {/* ── Step 2 (Athlete): Connect Data ── */}
        {step === 2 && form.role === "athlete" && (
          <div>
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-foreground mb-1">How will you import runs?</h1>
              <p className="text-muted-foreground">You can always change this later or use both methods.</p>
            </div>

            <div className="space-y-3 mb-6">
              {DATA_SOURCES.map(src => {
                const selected = form.dataSource === src.id;
                return (
                  <button key={src.id} onClick={() => set("dataSource", src.id)}
                    className={`w-full text-left rounded-xl border-2 p-5 transition-all
                      ${selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card/30 hover:border-primary/50"}`}
                  >
                    <div className="flex items-start gap-4">
                      <src.Icon className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">{src.title}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${src.badgeColor}`}>{src.badge}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{src.subtitle}</p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{src.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                        ${selected ? "border-primary bg-primary" : "border-border"}`}>
                        {selected && <Check size={11} className="text-[#F5F5F5]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-4 text-center">
              You can skip this and connect Strava or import files from the Activities page any time.
            </p>
          </div>
        )}

        {/* ── Step 3 (Athlete): Choose Plan ── */}
        {step === 3 && form.role === "athlete" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">Choose your plan</h1>
              <p className="text-muted-foreground">Free works forever — upgrade any time from your profile.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {(
                [
                  {
                    id: "free" as const,
                    title: "Free",
                    price: "$0",
                    sub: "Forever",
                    features: ["Dashboard + last 30 workouts", "20 AveraAI messages / month", "3 manual + 5 AI-designed plans"],
                  },
                  {
                    id: "pro" as const,
                    title: "Athlete Pro",
                    price: "$4.99",
                    sub: "per month",
                    features: ["Unlimited AveraAI, voice input & AI plans", "Auto Strava sync, intensity map & simulator", "Weekly summary email + CSV export"],
                  },
                ]
              ).map(plan => {
                const selected = form.plan === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => set("plan", plan.id)}
                    className={`relative text-left rounded-xl border p-6 transition-all duration-200
                      ${selected
                        ? "border-primary bg-primary/5 shadow-sm scale-[1.01]"
                        : "border-border bg-card/50 hover:border-primary/40 hover:bg-card"}`}
                  >
                    {selected && (
                      <div className="absolute top-4 right-4 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check size={12} className="text-[#F5F5F5]" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      {plan.id === "pro" && <Sparkles className="w-4 h-4 text-primary" />}
                      <h2 className="text-lg font-medium text-foreground">{plan.title}</h2>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">
                      <span className="text-2xl font-bold text-foreground">{plan.price}</span> {plan.sub}
                    </p>
                    <ul className="space-y-1.5">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <svg className="w-3.5 h-3.5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              You can switch plans any time from your profile — nothing here is locked in.
            </p>
          </div>
        )}

        {/* ── Step 2 (Coach): Get Started ── */}
        {step === 2 && form.role === "coach" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-1">You're all set, Coach!</h1>
              <p className="text-muted-foreground">Here's what's waiting for you in the portal.</p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                { Icon: LayoutDashboard, title: "Team Dashboard", desc: "See all your athletes' workload, heart rate, and training status at a glance." },
                { Icon: ShieldAlert, title: "Injury Risk Alerts", desc: "Thrive flags athletes with dangerous mileage spikes, low HRV, or early overtraining signals." },
                { Icon: Bot, title: "AveraAI Assistant", desc: "Ask AveraAI for advice on periodisation, athlete management, and recovery decisions." },
                { Icon: TrendingUp, title: "Load Analytics", desc: "Track team-wide training load trends week by week to keep everyone healthy." },
              ].map(({ Icon, title, desc }) => (
                <div key={title} className="flex gap-4 rounded-xl bg-card/40 border border-border p-4">
                  <Icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-0.5">{title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-primary/10 border border-primary/30 px-5 py-4">
              <p className="text-sm text-primary font-medium mb-1">Your invite code is ready</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Once you're in the portal, go to Athlete Roster to create your team and get an invite code to share with your athletes.
              </p>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex items-center justify-end mt-10">
          {isLastStep ? (
            <button
              onClick={finish}
              disabled={updateProfile.isPending || startingCheckout}
              className={`flex items-center gap-2 px-8 py-3 font-bold rounded-xl transition-all disabled:opacity-60 ${
                form.dataSource === "strava"
                  ? "bg-[#FC4C02] hover:bg-[#e34400] text-white"
                  : "bg-primary hover:bg-primary/80 text-[#F5F5F5]"
              }`}
            >
              {startingCheckout
                ? "Redirecting to checkout…"
                : updateProfile.isPending
                ? "Saving…"
                : form.role === "athlete" && form.plan === "pro"
                ? "Continue to checkout"
                : form.dataSource === "strava"
                ? "Connect Strava & finish"
                : "Let's go"}
              {!updateProfile.isPending && !startingCheckout && <Check size={16} />}
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary/80 text-[#F5F5F5] font-bold rounded-xl transition-all"
            >
              Continue <ChevronRight size={16} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
