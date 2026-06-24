import {
  Trees,
  // Zap removed in favor of other icons
  Route,
  Mountain,
  Sparkles,
  GraduationCap,
  HeartPulse,
  Layers,
  type LucideIcon,
} from "lucide-react";

export interface FocusConfig {
  /** Canonical label as stored in the coach's profile (primaryGoal). */
  label: string;
  /** Short headline shown in the dashboard banner. */
  headline: string;
  /** One-line description of how the portal is tuned for this discipline. */
  tagline: string;
  /** A short coaching philosophy or maxim for this discipline. */
  philosophy: string;
  /** What the coach's athletes are called in this discipline. */
  athleteNoun: string;
  /** Discipline-specific things this coach cares about most. */
  focusAreas: string[];
  /** Typical session types used in training for this discipline. */
  keySessionTypes: string[];
  /** Label for the weekly distance stat card (default: "Weekly Miles"). */
  distanceLabel: string;
  /** Icon representing the discipline. */
  icon: LucideIcon;
  /** Tailwind text color class for the accent. */
  accentText: string;
  /** Tailwind background tint for accent surfaces. */
  accentBg: string;
  /** Tailwind border tint for accent surfaces. */
  accentBorder: string;
}

const DEFAULT_FOCUS: FocusConfig = {
  label: "Coaching",
  headline: "Your Coaching Hub",
  tagline: "Monitor workload, injury risk, and training for every athlete.",
  philosophy: "Consistency beats perfection every time.",
  athleteNoun: "athletes",
  focusAreas: ["Weekly workload", "Injury risk", "Training plans", "Recovery"],
  keySessionTypes: ["Easy run", "Tempo", "Long run", "Recovery"],
  distanceLabel: "Weekly Miles",
  icon: Layers,
  accentText: "text-primary",
  accentBg: "bg-primary/10",
  accentBorder: "border-primary/20",
};

const FOCUS_MAP: Record<string, FocusConfig> = {
  "Cross Country": {
    label: "Cross Country",
    headline: "Cross Country Command Center",
    tagline: "Built for aerobic base building, terrain durability, and pack racing.",
    philosophy: "The race is won in the miles no one sees.",
    athleteNoun: "harriers",
    focusAreas: ["Aerobic base volume", "Hill & terrain strength", "Mileage progression", "Race-pack tactics"],
    keySessionTypes: ["Long run", "Hill repeats", "Progression run", "Fartlek"],
    distanceLabel: "Base Miles",
    icon: Trees,
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    accentBorder: "border-emerald-500/20",
  },
  "Track & Field": {
    label: "Track & Field",
    headline: "Track & Field Control Room",
    tagline: "Tuned for speed work, event-specific blocks, and peaking for meets.",
    philosophy: "Speed is a skill. Teach it, drill it, peak it.",
    athleteNoun: "track athletes",
    focusAreas: ["Speed & interval work", "Event-specific blocks", "Sprint / distance balance", "Meet-day peaking"],
    keySessionTypes: ["400m / 800m repeats", "Tempo intervals", "Sprint drills", "Race simulation"],
    distanceLabel: "Track Volume",
  icon: Route,
    accentText: "text-amber-400",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/20",
  },
  "Road Racing": {
    label: "Road Racing",
    headline: "Road Racing Headquarters",
    tagline: "Focused on threshold work, long-run progression, and race-pace fueling.",
    philosophy: "Respect the distance. Fuel the engine. Trust the process.",
    athleteNoun: "runners",
    focusAreas: ["Threshold & tempo", "Long-run progression", "Race-pace simulation", "Fueling strategy"],
    keySessionTypes: ["Threshold run", "Long run", "Race-pace miles", "Easy recovery"],
    distanceLabel: "Road Miles",
    icon: Route,
    accentText: "text-sky-400",
    accentBg: "bg-sky-500/10",
    accentBorder: "border-sky-500/20",
  },
  "Trail Running": {
    label: "Trail Running",
    headline: "Trail Running Basecamp",
    tagline: "Geared for vertical gain, technical terrain, and time-on-feet endurance.",
    philosophy: "Vert is earned, not given. Train the climb.",
    athleteNoun: "trail runners",
    focusAreas: ["Vertical gain", "Technical descents", "Time on feet", "Climb-specific strength"],
    keySessionTypes: ["Vert repeats", "Technical descent", "Power hike", "Time-on-feet long effort"],
    distanceLabel: "Vert + Miles",
    icon: Mountain,
    accentText: "text-lime-400",
    accentBg: "bg-lime-500/10",
    accentBorder: "border-lime-500/20",
  },
  "Youth Athletics": {
    label: "Youth Athletics",
    headline: "Youth Athletics Hub",
    tagline: "Designed for long-term development, injury prevention, and balanced load.",
    philosophy: "Build the athlete first. Results follow.",
    athleteNoun: "young athletes",
    focusAreas: ["Long-term development", "Injury prevention", "Skill & coordination", "Balanced load"],
    keySessionTypes: ["Fun tempo", "Coordination drills", "Easy long run", "Strides"],
    distanceLabel: "Weekly Miles",
    icon: Sparkles,
    accentText: "text-pink-400",
    accentBg: "bg-pink-500/10",
    accentBorder: "border-pink-500/20",
  },
  "Collegiate": {
    label: "Collegiate",
    headline: "Collegiate Program Center",
    tagline: "Built for season periodization, championship peaking, and high-volume management.",
    philosophy: "Manage the season. Peak when it counts.",
    athleteNoun: "athletes",
    focusAreas: ["Season periodization", "Championship peaking", "High-volume management", "Academic-balance load"],
    keySessionTypes: ["Workout Wednesday", "Long run", "Shakeout", "Championship tune-up"],
    distanceLabel: "Program Miles",
    icon: GraduationCap,
    accentText: "text-violet-400",
    accentBg: "bg-violet-500/10",
    accentBorder: "border-violet-500/20",
  },
  "Masters / Adult": {
    label: "Masters / Adult",
    headline: "Masters Training Hub",
    tagline: "Tuned for recovery-first load, longevity, and injury-risk monitoring.",
    philosophy: "Recovery is training. Honor it.",
    athleteNoun: "masters athletes",
    focusAreas: ["Recovery-first load", "Injury risk monitoring", "Sustainable volume", "Strength & mobility"],
    keySessionTypes: ["Easy aerobic", "Mobility work", "Gentle tempo", "Strength circuit"],
    distanceLabel: "Sustainable Miles",
    icon: HeartPulse,
    accentText: "text-rose-400",
    accentBg: "bg-rose-500/10",
    accentBorder: "border-rose-500/20",
  },
  "Multi-sport": {
    label: "Multi-sport",
    headline: "Multi-sport Command Center",
    tagline: "Balances cross-training, multi-modal load, and recovery across disciplines.",
    philosophy: "Every sport feeds the other. Balance is the edge.",
    athleteNoun: "multi-sport athletes",
    focusAreas: ["Cross-training balance", "Multi-modal load", "Sport-specific peaking", "Recovery across disciplines"],
    keySessionTypes: ["Run block", "Cross-train session", "Brick workout", "Recovery day"],
    distanceLabel: "Active Miles",
    icon: Layers,
    accentText: "text-teal-400",
    accentBg: "bg-teal-500/10",
    accentBorder: "border-teal-500/20",
  },
};

/**
 * Resolve a coach's selected focus (stored in profile.primaryGoal) to its
 * personalization config. Falls back to a neutral default for unknown or
 * empty values.
 */
export function getFocusConfig(focus: string | null | undefined): FocusConfig {
  if (!focus) return DEFAULT_FOCUS;
  return FOCUS_MAP[focus] ?? DEFAULT_FOCUS;
}
