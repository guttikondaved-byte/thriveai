import { useEffect, useState } from "react";

// A tiny localStorage-backed store shared across every demo page — the demo
// has no real backend, so this is what makes AveraAI's simulated actions
// (a message sent, a plan assigned) actually show up elsewhere in the demo
// instead of just being a line of chat text nobody else ever sees, and lets
// chat history survive navigation/refresh instead of resetting every time.

const STORAGE_KEY = "thriveai_demo_state_v1";

export interface DemoChatMessage {
  role: "user" | "assistant";
  text: string;
  actionChip?: string;
}

export interface DemoDirectMessage {
  id: number;
  authorRole: "coach" | "athlete";
  content: string;
  createdAt: string;
}

export interface DemoExtraPlan {
  id: number;
  athleteUserId: string;
  athleteName: string;
  name: string;
  goal: string;
  status: "active" | "paused";
  weeklyMileage: number;
  startDate: string;
  endDate: string;
}

interface DemoState {
  coachChat: DemoChatMessage[];
  athleteChat: DemoChatMessage[];
  directMessages: Record<string, DemoDirectMessage[]>;
  extraPlans: DemoExtraPlan[];
}

const EMPTY_STATE: DemoState = { coachChat: [], athleteChat: [], directMessages: {}, extraPlans: [] };

function load(): DemoState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_STATE;
  }
}

let state: DemoState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full/unavailable — the demo still works, it just won't persist.
  }
  listeners.forEach((l) => l());
}

export function getDemoState(): DemoState {
  return state;
}

function updateDemoState(updater: (prev: DemoState) => DemoState) {
  state = updater(state);
  persist();
}

// Subscribes the calling component to the store and returns the current
// state, re-rendering whenever any demo page updates it.
export function useDemoState(): DemoState {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}

export function appendCoachChat(message: DemoChatMessage) {
  updateDemoState((prev) => ({ ...prev, coachChat: [...prev.coachChat, message] }));
}

export function appendAthleteChat(message: DemoChatMessage) {
  updateDemoState((prev) => ({ ...prev, athleteChat: [...prev.athleteChat, message] }));
}

export function addDirectMessage(athleteUserId: string, authorRole: "coach" | "athlete", content: string) {
  updateDemoState((prev) => ({
    ...prev,
    directMessages: {
      ...prev.directMessages,
      [athleteUserId]: [
        ...(prev.directMessages[athleteUserId] ?? []),
        { id: Date.now() + Math.random(), authorRole, content, createdAt: new Date().toISOString() },
      ],
    },
  }));
}

export function addExtraPlan(plan: Omit<DemoExtraPlan, "id">) {
  updateDemoState((prev) => ({ ...prev, extraPlans: [...prev.extraPlans, { ...plan, id: Date.now() }] }));
}

export function resetDemoState() {
  state = EMPTY_STATE;
  persist();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
