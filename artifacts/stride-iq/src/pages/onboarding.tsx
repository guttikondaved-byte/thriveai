import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Role = "athlete" | "coach";

const ROLES = [
  {
    id: "athlete" as Role,
    label: "Student Athlete",
    description: "Track your personal training, monitor injury risk, and chat with your AI coach to reach your race goals.",
    icon: "🏃",
    features: ["Personal dashboard & activity log", "Injury risk alerts", "AI coach chat (AveraAI)", "Custom training plans"],
    gradient: "from-cyan-500/20 to-blue-600/20",
    border: "border-cyan-500",
    shadow: "shadow-cyan-500/20",
    cta: "I'm an Athlete",
  },
  {
    id: "coach" as Role,
    label: "Coach",
    description: "Oversee your entire team's workload, flag injury risks before practice, and keep every athlete on track.",
    icon: "📋",
    features: ["Team roster & risk dashboard", "Athlete workload monitoring", "Team-wide injury alerts", "Training load analytics"],
    gradient: "from-orange-500/20 to-amber-600/20",
    border: "border-orange-500",
    shadow: "shadow-orange-500/20",
    cta: "I'm a Coach",
  },
];

export default function Onboarding() {
  const [selected, setSelected] = useState<Role | null>(null);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();

  async function handleContinue() {
    if (!selected) return;
    await updateProfile.mutateAsync({ data: { userRole: selected } });
    await qc.invalidateQueries({ queryKey: getGetAthleteProfileQueryKey() });
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-12">
          <div className="text-5xl mb-4">⚡</div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Welcome to Thrive
          </h1>
          <p className="text-slate-400 text-lg">
            Tell us who you are so we can set up the right experience for you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {ROLES.map((role) => {
            const isSelected = selected === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setSelected(role.id)}
                className={`relative text-left rounded-2xl border-2 p-7 transition-all duration-200 cursor-pointer
                  bg-gradient-to-br ${role.gradient}
                  ${isSelected
                    ? `${role.border} shadow-xl ${role.shadow} scale-[1.02]`
                    : "border-slate-700/60 hover:border-slate-500 hover:scale-[1.01]"
                  }`}
              >
                {isSelected && (
                  <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                <div className="text-5xl mb-4">{role.icon}</div>
                <h2 className="text-2xl font-bold text-white mb-2">{role.label}</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-5">{role.description}</p>

                <ul className="space-y-2">
                  {role.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleContinue}
            disabled={!selected || updateProfile.isPending}
            className={`px-12 py-3.5 rounded-xl font-semibold text-base transition-all duration-200
              ${selected
                ? "bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/25 hover:scale-105"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
          >
            {updateProfile.isPending
              ? "Setting up…"
              : selected
                ? ROLES.find((r) => r.id === selected)!.cta
                : "Select your role to continue"}
          </button>
          {!selected && (
            <p className="text-slate-600 text-sm">Choose a role above to get started</p>
          )}
        </div>
      </div>
    </div>
  );
}
