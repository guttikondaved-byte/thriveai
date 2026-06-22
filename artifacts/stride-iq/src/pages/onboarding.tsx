import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Check, Upload, Zap, Users, User } from "lucide-react";

type Role = "athlete" | "coach";
type FitnessLevel = "beginner" | "intermediate" | "advanced" | "elite";
type CoachExp = "new" | "developing" | "experienced" | "veteran";

interface FormData {
  role: Role | null;
  name: string;
  age: string;
  fitnessLevel: FitnessLevel;
  primaryGoal: string;
  weeklyMileageGoal: string;
  teamName: string;
  coachingExp: CoachExp | null;
  athleteCount: string;
  coachFocus: string;
  dataSource: "gpx" | "manual" | null;
}

const ATHLETE_STEPS = ["Your Role", "About You", "Connect Data"];
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
  "Qualify for Boston",
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
    id: "gpx" as const,
    icon: "📁",
    title: "Import GPX Files",
    subtitle: "Works with every GPS watch",
    desc: "Export a .gpx file from Garmin Connect, Apple Health, Coros, Polar, or any GPS watch.",
    badge: "Free · Recommended",
    badgeColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "manual" as const,
    icon: "✏️",
    title: "Manual Logging",
    subtitle: "Log runs by hand",
    desc: "Enter distance, duration, heart rate, and effort directly — no GPS required.",
    badge: "Always available",
    badgeColor: "bg-slate-700/60 text-slate-400 border-slate-600/40",
  },
];

function StepIndicator({ step, steps }: { step: number; steps: string[] }) {
  return (
    <div className="flex items-center gap-3 mb-12">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < step  ? "bg-cyan-500 text-slate-900" :
                i === step ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400" :
                "bg-slate-800 border border-slate-700 text-slate-600"}`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block
              ${i === step ? "text-white" : i < step ? "text-cyan-400" : "text-slate-600"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-8 sm:w-16 h-px ${i < step ? "bg-cyan-500" : "bg-slate-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

const inputCls = (error?: string) =>
  `w-full bg-slate-800/60 border rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition ${
    error ? "border-red-500" : "border-slate-700 focus:border-cyan-500"
  }`;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    role: null,
    name: "", age: "",
    fitnessLevel: "intermediate",
    primaryGoal: "",
    weeklyMileageGoal: "",
    teamName: "",
    coachingExp: null,
    athleteCount: "",
    coachFocus: "",
    dataSource: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();

  const steps = form.role === "coach" ? COACH_STEPS : ATHLETE_STEPS;

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validateStep0() {
    if (!form.role) { setErrors({ role: "Please select a role to continue" }); return false; }
    return true;
  }

  function validateStep1Athlete() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.age) e.age = "Age is required";
    else if (isNaN(Number(form.age)) || Number(form.age) < 10 || Number(form.age) > 99)
      e.age = "Enter a valid age (10–99)";
    if (!form.weeklyMileageGoal) e.weeklyMileageGoal = "Weekly goal is required";
    if (!form.primaryGoal) e.primaryGoal = "Select or type a goal";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep1Coach() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.teamName.trim()) e.teamName = "Team name is required";
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
    await qc.invalidateQueries({ queryKey: getGetAthleteProfileQueryKey() });
    navigate("/");
  }

  const isLastStep = step === steps.length - 1;

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
            <Zap size={16} className="text-slate-900" fill="currentColor" />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">Thrive</span>
        </div>

        <StepIndicator step={step} steps={steps} />

        {/* ── Step 0: Role Selection ── */}
        {step === 0 && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-1">Welcome to Thrive</h1>
              <p className="text-slate-400">First, tell us how you'll be using the platform.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: "athlete" as Role,
                  Icon: User,
                  emoji: "🏃",
                  label: "Student Athlete",
                  desc: "I want to track my own training, monitor injury risk, and get personalised AI coaching.",
                  features: ["Personal dashboard & activity log", "AI coach AveraAI", "Injury risk alerts", "Custom training plans"],
                },
                {
                  id: "coach" as Role,
                  Icon: Users,
                  emoji: "📋",
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
                    className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200
                      ${selected
                        ? "border-cyan-500 bg-cyan-500/10 shadow-xl shadow-cyan-500/15 scale-[1.02]"
                        : "border-slate-700/60 bg-slate-800/30 hover:border-slate-500 hover:scale-[1.01]"}`}
                  >
                    {selected && (
                      <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                        <Check size={13} className="text-slate-900" />
                      </div>
                    )}
                    <div className="text-4xl mb-4">{role.emoji}</div>
                    <h2 className="text-xl font-bold text-white mb-1.5">{role.label}</h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-4">{role.desc}</p>
                    <ul className="space-y-1.5">
                      {role.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                          <svg className="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {errors.role && <p className="text-red-400 text-xs mt-3 text-center">{errors.role}</p>}
          </div>
        )}

        {/* ── Step 1 (Athlete): About You ── */}
        {step === 1 && form.role === "athlete" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Tell us about yourself</h1>
              <p className="text-slate-400">We'll personalise your training and AI coaching based on this.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Alex Johnson"
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Age <span className="text-red-400">*</span></label>
                <input
                  type="number" value={form.age} onChange={e => set("age", e.target.value)}
                  placeholder="17"
                  className={inputCls(errors.age)}
                />
                {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Weekly Distance Goal (km) <span className="text-red-400">*</span></label>
                <input
                  type="number" step="0.1" value={form.weeklyMileageGoal} onChange={e => set("weeklyMileageGoal", e.target.value)}
                  placeholder="50"
                  className={inputCls(errors.weeklyMileageGoal)}
                />
                {errors.weeklyMileageGoal && <p className="text-red-400 text-xs mt-1">{errors.weeklyMileageGoal}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Fitness Level</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {FITNESS_LEVELS.map(fl => (
                  <button key={fl.value} onClick={() => set("fitnessLevel", fl.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all
                      ${form.fitnessLevel === fl.value
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-700/60 hover:border-slate-500 bg-slate-800/40"}`}
                  >
                    <p className={`text-sm font-semibold ${form.fitnessLevel === fl.value ? "text-cyan-400" : "text-white"}`}>{fl.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{fl.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Primary Goal <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {ATHLETE_GOALS.map(g => (
                  <button key={g} onClick={() => set("primaryGoal", g)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all
                      ${form.primaryGoal === g
                        ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
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
              {errors.primaryGoal && <p className="text-red-400 text-xs mt-1">{errors.primaryGoal}</p>}
            </div>
          </div>
        )}

        {/* ── Step 1 (Coach): Your Profile ── */}
        {step === 1 && form.role === "coach" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Tell us about your coaching</h1>
              <p className="text-slate-400">We'll customise your coach portal and team tools.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Coach Taylor"
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Team / Club Name <span className="text-red-400">*</span></label>
                <input
                  value={form.teamName}
                  onChange={e => set("teamName", e.target.value)}
                  placeholder="Westview Track & Field"
                  className={inputCls(errors.teamName)}
                />
                {errors.teamName && <p className="text-red-400 text-xs mt-1">{errors.teamName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Number of Athletes <span className="text-red-400">*</span></label>
                <input
                  type="number" min="1" value={form.athleteCount}
                  onChange={e => set("athleteCount", e.target.value)}
                  placeholder="24"
                  className={inputCls(errors.athleteCount)}
                />
                {errors.athleteCount && <p className="text-red-400 text-xs mt-1">{errors.athleteCount}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Coaching Experience <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {COACHING_EXP.map(exp => (
                  <button key={exp.value} onClick={() => set("coachingExp", exp.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all
                      ${form.coachingExp === exp.value
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-700/60 hover:border-slate-500 bg-slate-800/40"}`}
                  >
                    <p className={`text-sm font-semibold ${form.coachingExp === exp.value ? "text-cyan-400" : "text-white"}`}>{exp.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{exp.desc}</p>
                  </button>
                ))}
              </div>
              {errors.coachingExp && <p className="text-red-400 text-xs mt-2">{errors.coachingExp}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Coaching Focus <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2">
                {COACH_FOCUSES.map(f => (
                  <button key={f} onClick={() => set("coachFocus", form.coachFocus === f ? "" : f)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all
                      ${form.coachFocus === f
                        ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {errors.coachFocus && <p className="text-red-400 text-xs mt-2">{errors.coachFocus}</p>}
            </div>
          </div>
        )}

        {/* ── Step 2 (Athlete): Connect Data ── */}
        {step === 2 && form.role === "athlete" && (
          <div>
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-white mb-1">How will you import runs?</h1>
              <p className="text-slate-400">You can always change this later or use both methods.</p>
            </div>

            <div className="space-y-3 mb-6">
              {DATA_SOURCES.map(src => {
                const selected = form.dataSource === src.id;
                return (
                  <button key={src.id} onClick={() => set("dataSource", src.id)}
                    className={`w-full text-left rounded-xl border-2 p-5 transition-all
                      ${selected
                        ? "border-cyan-500 bg-cyan-500/10"
                        : "border-slate-700/60 bg-slate-800/30 hover:border-slate-500"}`}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl mt-0.5">{src.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{src.title}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${src.badgeColor}`}>{src.badge}</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-1">{src.subtitle}</p>
                        <p className="text-sm text-slate-400 leading-relaxed">{src.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all
                        ${selected ? "border-cyan-500 bg-cyan-500" : "border-slate-600"}`}>
                        {selected && <Check size={11} className="text-slate-900" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-5 py-4 flex gap-3">
              <Upload size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-300 font-medium mb-0.5">Strava export works too</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Export any run from Strava as a .gpx file (Activity → ⋯ → Export GPX) and import it here. Free on all Strava plans.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 text-center">
              You can skip this — import files or log manually from the Activities page any time.
            </p>
          </div>
        )}

        {/* ── Step 2 (Coach): Get Started ── */}
        {step === 2 && form.role === "coach" && (
          <div>
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-1">You're all set, Coach!</h1>
              <p className="text-slate-400">Here's what's waiting for you in the portal.</p>
            </div>

            <div className="space-y-3 mb-8">
              {[
                { icon: "📊", title: "Team Dashboard", desc: "See all your athletes' workload, heart rate, and training status at a glance." },
                { icon: "⚠️", title: "Injury Risk Alerts", desc: "Thrive flags athletes with dangerous mileage spikes, low HRV, or early overtraining signals." },
                { icon: "🤖", title: "AveraAI Assistant", desc: "Ask AveraAI for advice on periodisation, athlete management, and recovery decisions." },
                { icon: "📈", title: "Load Analytics", desc: "Track team-wide training load trends week by week to keep everyone healthy." },
              ].map(item => (
                <div key={item.title} className="flex gap-4 rounded-xl bg-slate-800/40 border border-slate-700/50 p-4">
                  <span className="text-2xl shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {form.teamName && (
              <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-5 py-3 text-sm text-cyan-300 text-center">
                Ready to set up <span className="font-semibold">{form.teamName}</span> 🏆
              </div>
            )}
          </div>
        )}

        {/* ── Nav Buttons ── */}
        <div className="flex items-center justify-between mt-10">
          <button
            onClick={() => setStep(s => s - 1)}
            className={`flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-slate-800
              ${step === 0 ? "invisible" : ""}`}
          >
            <ChevronLeft size={16} /> Back
          </button>

          {isLastStep ? (
            <button
              onClick={finish}
              disabled={updateProfile.isPending}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all disabled:opacity-60 disabled:scale-100"
            >
              {updateProfile.isPending ? "Setting up…" : (
                <>
                  <Check size={16} />
                  {form.role === "coach" ? "Open Coach Portal" : "Open Dashboard"}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/25 hover:scale-105 transition-all"
            >
              Continue <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
