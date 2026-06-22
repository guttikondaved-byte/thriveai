import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronLeft, Check, Upload, Zap } from "lucide-react";

type Role = "athlete" | "coach";
type FitnessLevel = "beginner" | "intermediate" | "advanced" | "elite";

interface FormData {
  name: string;
  age: string;
  fitnessLevel: FitnessLevel;
  primaryGoal: string;
  weeklyMileageGoal: string;
  role: Role | null;
  dataSource: "gpx" | "manual" | null;
}

const STEPS = ["About You", "Your Role", "Connect Data"];

const FITNESS_LEVELS: { value: FitnessLevel; label: string; desc: string }[] = [
  { value: "beginner",     label: "Beginner",     desc: "Running < 6 months" },
  { value: "intermediate", label: "Intermediate",  desc: "1–3 years consistent training" },
  { value: "advanced",     label: "Advanced",      desc: "3+ years, competitive racing" },
  { value: "elite",        label: "Elite",         desc: "Collegiate / post-collegiate" },
];

const GOALS = [
  "Finish my first 5K",
  "Break 20 min in 5K",
  "Complete a half marathon",
  "Run a full marathon",
  "Improve race times",
  "Stay injury-free",
  "Build base mileage",
  "Qualify for Boston",
];

const DATA_SOURCES = [
  {
    id: "gpx" as const,
    icon: "📁",
    title: "Import GPX Files",
    subtitle: "Works with every GPS watch",
    desc: "Export a .gpx file from Garmin Connect, Apple Health, Coros, Polar, or any GPS watch. Free, instant, and works everywhere.",
    badge: "Free · Recommended",
    badgeColor: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  },
  {
    id: "manual" as const,
    icon: "✏️",
    title: "Manual Logging",
    subtitle: "Log runs by hand",
    desc: "Enter your runs manually — distance, duration, heart rate, effort. Perfect if you prefer to keep it simple.",
    badge: "Always available",
    badgeColor: "bg-slate-700/60 text-slate-400 border-slate-600/40",
  },
];

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-3 mb-12">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
              ${i < step ? "bg-cyan-500 text-slate-900" :
                i === step ? "bg-cyan-500/20 border-2 border-cyan-500 text-cyan-400" :
                "bg-slate-800 border border-slate-700 text-slate-600"}`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${i === step ? "text-white" : i < step ? "text-cyan-400" : "text-slate-600"}`}>
              {label}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`w-8 sm:w-16 h-px ${i < step ? "bg-cyan-500" : "bg-slate-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>({
    name: "", age: "", fitnessLevel: "intermediate",
    primaryGoal: "", weeklyMileageGoal: "", role: null, dataSource: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validateStep0() {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (form.age && (isNaN(Number(form.age)) || Number(form.age) < 10 || Number(form.age) > 99))
      e.age = "Enter a valid age (10–99)";
    if (!form.primaryGoal) e.primaryGoal = "Select or enter a goal";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep1() {
    if (!form.role) { setErrors({ role: "Select a role to continue" }); return false; }
    return true;
  }

  function next() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  async function finish() {
    await updateProfile.mutateAsync({
      data: {
        name: form.name.trim(),
        ...(form.age ? { age: parseInt(form.age) } : {}),
        fitnessLevel: form.fitnessLevel,
        primaryGoal: form.primaryGoal,
        ...(form.weeklyMileageGoal ? { weeklyMileageGoal: parseFloat(form.weeklyMileageGoal) } : {}),
        userRole: form.role!,
      }
    });
    await qc.invalidateQueries({ queryKey: getGetAthleteProfileQueryKey() });
    navigate("/");
  }

  const isLastStep = step === STEPS.length - 1;

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

        <StepIndicator step={step} total={STEPS.length} />

        {/* ── Step 0: About You ── */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">Tell us about yourself</h1>
              <p className="text-slate-400">We'll use this to personalise your training and AI coaching.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name <span className="text-red-400">*</span></label>
                <input
                  value={form.name}
                  onChange={e => set("name", e.target.value)}
                  placeholder="Alex Johnson"
                  className={`w-full bg-slate-800/60 border rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition
                    ${errors.name ? "border-red-500" : "border-slate-700 focus:border-cyan-500"}`}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Age <span className="text-slate-500">(optional)</span></label>
                <input
                  type="number" value={form.age} onChange={e => set("age", e.target.value)}
                  placeholder="17"
                  className={`w-full bg-slate-800/60 border rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition
                    ${errors.age ? "border-red-500" : "border-slate-700 focus:border-cyan-500"}`}
                />
                {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Weekly Distance Goal <span className="text-slate-500">(km, optional)</span></label>
                <input
                  type="number" step="0.1" value={form.weeklyMileageGoal} onChange={e => set("weeklyMileageGoal", e.target.value)}
                  placeholder="50"
                  className="w-full bg-slate-800/60 border border-slate-700 focus:border-cyan-500 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition"
                />
              </div>
            </div>

            {/* Fitness Level */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Fitness Level</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {FITNESS_LEVELS.map(fl => (
                  <button
                    key={fl.value}
                    onClick={() => set("fitnessLevel", fl.value)}
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

            {/* Primary Goal */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Primary Goal <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2 mb-2.5">
                {GOALS.map(g => (
                  <button
                    key={g}
                    onClick={() => set("primaryGoal", g)}
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
                value={GOALS.includes(form.primaryGoal) ? "" : form.primaryGoal}
                onChange={e => set("primaryGoal", e.target.value)}
                placeholder="Or type your own goal…"
                className={`w-full bg-slate-800/60 border rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition
                  ${errors.primaryGoal ? "border-red-500" : "border-slate-700 focus:border-cyan-500"}`}
              />
              {errors.primaryGoal && <p className="text-red-400 text-xs mt-1">{errors.primaryGoal}</p>}
            </div>
          </div>
        )}

        {/* ── Step 1: Role ── */}
        {step === 1 && (
          <div>
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-white mb-1">What's your role?</h1>
              <p className="text-slate-400">We'll show you the right dashboard and tools.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  id: "athlete" as Role,
                  icon: "🏃",
                  label: "Student Athlete",
                  desc: "Track your personal training, monitor injury risk, and get personalised AI coaching.",
                  features: ["Personal dashboard & activity log", "AI coach AveraAI", "Injury risk alerts", "Custom training plans"],
                },
                {
                  id: "coach" as Role,
                  icon: "📋",
                  label: "Coach",
                  desc: "Oversee your entire team's workload, flag injury risks early, and keep everyone on track.",
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
                    <div className="text-4xl mb-4">{role.icon}</div>
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

        {/* ── Step 2: Data Sources ── */}
        {step === 2 && (
          <div>
            <div className="mb-7">
              <h1 className="text-3xl font-bold text-white mb-1">How will you import runs?</h1>
              <p className="text-slate-400">You can always change this later or use both methods.</p>
            </div>

            <div className="space-y-3 mb-6">
              {DATA_SOURCES.map(src => {
                const selected = form.dataSource === src.id;
                return (
                  <button
                    key={src.id}
                    onClick={() => set("dataSource", src.id)}
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

            {/* Strava note */}
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 px-5 py-4 flex gap-3">
              <Upload size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-slate-300 font-medium mb-0.5">Strava export works too</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Even without a Strava API subscription, you can export any run as a .gpx file from Strava (Activity → ⋯ → Export GPX) and import it here. Free on all Strava plans.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mt-4 text-center">
              You can skip this — you can always import files or log manually from the Activities page.
            </p>
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
