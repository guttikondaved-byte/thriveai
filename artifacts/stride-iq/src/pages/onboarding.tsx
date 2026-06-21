import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type CoachId = "avera" | "kai" | "nova" | "rex";

interface Coach {
  id: CoachId;
  name: string;
  title: string;
  specialty: string;
  personality: string;
  tags: string[];
  gradient: string;
  accentColor: string;
  avatar: string;
}

const COACHES: Coach[] = [
  {
    id: "avera",
    name: "Avera",
    title: "Balanced Coach",
    specialty: "Injury Prevention & Smart Progression",
    personality: "Warm, analytical, and evidence-based. Avera keeps you healthy and consistent over the long haul.",
    tags: ["Injury Prevention", "All Levels", "Balanced"],
    gradient: "from-cyan-500/20 to-blue-600/20",
    accentColor: "border-cyan-500 shadow-cyan-500/20",
    avatar: "🧠",
  },
  {
    id: "kai",
    name: "Kai",
    title: "Speed Coach",
    specialty: "Race Performance & VO₂ Max",
    personality: "Energetic, data-driven, competitive. Kai pushes you to break PRs with structured speed work.",
    tags: ["Speed Work", "Race-Focused", "Data-Driven"],
    gradient: "from-orange-500/20 to-red-600/20",
    accentColor: "border-orange-500 shadow-orange-500/20",
    avatar: "⚡",
  },
  {
    id: "nova",
    name: "Nova",
    title: "Wellness Coach",
    specialty: "Recovery, HRV & Sustainable Training",
    personality: "Calm, holistic, and mindful. Nova prioritizes long-term health and recovery over short-term gains.",
    tags: ["Recovery", "Holistic", "Low Injury Risk"],
    gradient: "from-violet-500/20 to-purple-600/20",
    accentColor: "border-violet-500 shadow-violet-500/20",
    avatar: "🌿",
  },
  {
    id: "rex",
    name: "Rex",
    title: "Endurance Coach",
    specialty: "Marathon & Ultra Distance",
    personality: "No-nonsense, tough, and experienced. Rex builds the mileage base needed to conquer long distances.",
    tags: ["Marathon", "Ultra", "High Mileage"],
    gradient: "from-emerald-500/20 to-teal-600/20",
    accentColor: "border-emerald-500 shadow-emerald-500/20",
    avatar: "🏔️",
  },
];

export default function Onboarding() {
  const [selected, setSelected] = useState<CoachId | null>(null);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const updateProfile = useUpdateAthleteProfile();

  async function handleStart() {
    if (!selected) return;
    await updateProfile.mutateAsync({ data: { selectedCoach: selected } });
    await qc.invalidateQueries({ queryKey: getGetAthleteProfileQueryKey() });
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 text-cyan-400 text-sm font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Welcome to Thrive
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Choose Your AI Coach
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Your coach shapes every training recommendation, injury alert, and conversation. Pick the one that matches your goals.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {COACHES.map((coach) => {
            const isSelected = selected === coach.id;
            return (
              <button
                key={coach.id}
                onClick={() => setSelected(coach.id)}
                className={`relative text-left rounded-2xl border-2 p-5 transition-all duration-200 cursor-pointer group
                  bg-gradient-to-br ${coach.gradient}
                  ${isSelected
                    ? `${coach.accentColor} shadow-lg scale-[1.02]`
                    : "border-slate-700/60 hover:border-slate-500 hover:scale-[1.01]"
                  }`}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                    <svg className="w-3 h-3 text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                <div className="text-4xl mb-3">{coach.avatar}</div>
                <div className="mb-1">
                  <span className="text-xl font-bold text-white">{coach.name}</span>
                  <span className="ml-2 text-xs text-slate-400 font-medium uppercase tracking-wider">{coach.title}</span>
                </div>
                <p className="text-xs text-cyan-400 font-medium mb-3">{coach.specialty}</p>
                <p className="text-slate-400 text-xs leading-relaxed mb-4">{coach.personality}</p>
                <div className="flex flex-wrap gap-1.5">
                  {coach.tags.map((tag) => (
                    <span key={tag} className="text-[10px] bg-white/5 border border-white/10 text-slate-400 rounded-full px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleStart}
            disabled={!selected || updateProfile.isPending}
            className={`px-10 py-3.5 rounded-xl font-semibold text-base transition-all duration-200
              ${selected
                ? "bg-cyan-500 hover:bg-cyan-400 text-slate-900 shadow-lg shadow-cyan-500/25 hover:scale-105"
                : "bg-slate-700 text-slate-500 cursor-not-allowed"
              }`}
          >
            {updateProfile.isPending ? "Starting…" : selected ? `Start Training with ${COACHES.find(c => c.id === selected)?.name}` : "Select a Coach to Continue"}
          </button>
          {!selected && (
            <p className="text-slate-600 text-sm">Pick a coach above to get started</p>
          )}
        </div>
      </div>
    </div>
  );
}
