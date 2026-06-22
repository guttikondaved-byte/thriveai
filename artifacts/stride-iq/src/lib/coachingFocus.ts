import {
  Trees,
  Zap,
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
  /** What the coach's athletes are called in this discipline. */
  athleteNoun: string;
  /** Discipline-specific things this coach cares about most. */
  focusAreas: string[];
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
  athleteNoun: "athletes",
  focusAreas: ["Weekly workload", "Injury risk", "Training plans", "Recovery"],
  icon: Layers,
  accentText: "text-cyan-400",
  accentBg: "bg-cyan-500/10",
  accentBorder: "border-cyan-500/20",
};

const FOCUS_MAP: Record<string, FocusConfig> = {
  "Cross Country": {
    label: "Cross Country",
    headline: "Cross Country Command Center",
    tagline: "Built for aerobic base building, terrain durability, and pack racing.",
    athleteNoun: "harriers",
    focusAreas: ["Aerobic base volume", "Hill & terrain strength", "Mileage progression", "Race-pack tactics"],
    icon: Trees,
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    accentBorder: "border-emerald-500/20",
  },
  "Track & Field": {
    label: "Track & Field",
    headline: "Track & Field Control Room",
    tagline: "Tuned for speed work, event-specific blocks, and peaking for meets.",
    athleteNoun: "athletes",
    focusAreas: ["Speed & interval work", "Event-specific blocks", "Sprint / distance balance", "Meet-day peaking"],
    icon: Zap,
    accentText: "text-amber-400",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/20",
  },
  "Road Racing": {
    label: "Road Racing",
    headline: "Road Racing Headquarters",
    tagline: "Focused on threshold work, long-run progression, and race-pace fueling.",
    athleteNoun: "runners",
    focusAreas: ["Threshold & tempo", "Long-run progression", "Race-pace simulation", "Fueling strategy"],
    icon: Route,
    accentText: "text-sky-400",
    accentBg: "bg-sky-500/10",
    accentBorder: "border-sky-500/20",
  },
  "Trail Running": {
    label: "Trail Running",
    headline: "Trail Running Basecamp",
    tagline: "Geared for vertical gain, technical terrain, and time-on-feet endurance.",
    athleteNoun: "runners",
    focusAreas: ["Vertical gain", "Technical descents", "Time on feet", "Climb-specific strength"],
    icon: Mountain,
    accentText: "text-lime-400",
    accentBg: "bg-lime-500/10",
    accentBorder: "border-lime-500/20",
  },
  "Youth Athletics": {
    label: "Youth Athletics",
    headline: "Youth Athletics Hub",
    tagline: "Designed for long-term development, injury prevention, and balanced load.",
    athleteNoun: "young athletes",
    focusAreas: ["Long-term development", "Injury prevention", "Skill & coordination", "Balanced load"],
    icon: Sparkles,
    accentText: "text-pink-400",
    accentBg: "bg-pink-500/10",
    accentBorder: "border-pink-500/20",
  },
  "Collegiate": {
    label: "Collegiate",
    headline: "Collegiate Program Center",
    tagline: "Built for season periodization, championship peaking, and high-volume management.",
    athleteNoun: "athletes",
    focusAreas: ["Season periodization", "Championship peaking", "High-volume management", "Academic-balance load"],
    icon: GraduationCap,
    accentText: "text-violet-400",
    accentBg: "bg-violet-500/10",
    accentBorder: "border-violet-500/20",
  },
  "Masters / Adult": {
    label: "Masters / Adult",
    headline: "Masters Training Hub",
    tagline: "Tuned for recovery-first load, longevity, and injury-risk monitoring.",
    athleteNoun: "athletes",
    focusAreas: ["Recovery-first load", "Injury risk monitoring", "Sustainable volume", "Strength & mobility"],
    icon: HeartPulse,
    accentText: "text-rose-400",
    accentBg: "bg-rose-500/10",
    accentBorder: "border-rose-500/20",
  },
  "Multi-sport": {
    label: "Multi-sport",
    headline: "Multi-sport Command Center",
    tagline: "Balances cross-training, multi-modal load, and recovery across disciplines.",
    athleteNoun: "athletes",
    focusAreas: ["Cross-training balance", "Multi-modal load", "Sport-specific peaking", "Recovery across disciplines"],
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
