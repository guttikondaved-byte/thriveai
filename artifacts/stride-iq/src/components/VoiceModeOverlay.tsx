import { useEffect, useRef } from "react";
import { X, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export type VoicePhase = "listening" | "processing" | "responding";

interface VoiceModeOverlayProps {
  open: boolean;
  phase: VoicePhase;
  userText?: string;
  assistantText?: string;
  onStop: () => void;
  onClose: () => void;
}

const PHASE_ANIMATION: Record<VoicePhase, string> = {
  listening: "voice-orb-listen 2.2s ease-in-out infinite",
  processing: "voice-orb-process 1.4s ease-in-out infinite",
  responding: "voice-orb-respond 2.4s ease-in-out infinite",
};

const PHASE_LABEL: Record<VoicePhase, string> = {
  listening: "Listening…",
  processing: "Thinking…",
  responding: "Speaking…",
};

// Tiny synthesized chimes (Web Audio, no audio files) marking each state
// change — open/listening, processing, responding, and close — so voice
// mode has the same audible turn-taking cues as ChatGPT's voice UI.
function useVoiceModeSounds(open: boolean, phase: VoicePhase) {
  const ctxRef = useRef<AudioContext | null>(null);
  const prevPhaseRef = useRef<VoicePhase | null>(null);

  function getCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctxRef.current) ctxRef.current = new Ctor();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }

  function playTone(freqFrom: number, freqTo: number, duration: number, peakGain = 0.1) {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqTo, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.03);
  }

  useEffect(() => {
    if (!open) {
      prevPhaseRef.current = null;
      return;
    }
    if (phase === prevPhaseRef.current) return;
    prevPhaseRef.current = phase;
    if (phase === "listening") playTone(520, 780, 0.14);
    else if (phase === "processing") playTone(660, 440, 0.1);
    else if (phase === "responding") playTone(440, 700, 0.13);
  }, [open, phase]);

  return { playCloseTone: () => playTone(600, 320, 0.16, 0.09) };
}

export function VoiceModeOverlay({ open, phase, userText, assistantText, onStop, onClose }: VoiceModeOverlayProps) {
  const { playCloseTone } = useVoiceModeSounds(open, phase);

  if (!open) return null;

  const caption = phase === "responding" ? assistantText : phase === "processing" ? userText : undefined;

  function handleClose() {
    playCloseTone();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-background/55 backdrop-blur-2xl px-6 py-10 animate-in fade-in duration-200"
      role="dialog"
      aria-label="AveraAI voice mode"
    >
      <button
        onClick={handleClose}
        aria-label="Close voice mode"
        className="self-end w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
        <div className="relative w-48 h-48 flex items-center justify-center">
          {phase === "listening" && (
            <>
              <span
                className="absolute inset-0 rounded-full bg-primary/25"
                style={{ animation: "voice-ring-pulse 2.2s ease-out infinite" }}
              />
              <span
                className="absolute inset-0 rounded-full bg-primary/25"
                style={{ animation: "voice-ring-pulse 2.2s ease-out infinite", animationDelay: "1.1s" }}
              />
            </>
          )}
          <div
            className="w-32 h-32 rounded-full"
            style={{
              background:
                phase === "responding"
                  ? "radial-gradient(circle at 32% 28%, #a9e6ff, #4aa9e6 55%, #2E90D9 100%)"
                  : "radial-gradient(circle at 32% 28%, #bdedff, #63b6ea 60%, #2E90D9 100%)",
              boxShadow: "0 0 60px -12px rgba(46,144,217,0.5)",
              animation: PHASE_ANIMATION[phase],
            }}
          />
        </div>

        <div className="text-center max-w-md px-4 min-h-[4.5rem]">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase mb-2">
            {PHASE_LABEL[phase]}
          </p>
          {caption && (
            <p className="text-foreground text-[15px] leading-relaxed line-clamp-4">{caption}</p>
          )}
        </div>
      </div>

      <button
        onClick={onStop}
        disabled={phase !== "listening"}
        aria-label="Stop and send"
        className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-all",
          phase === "listening"
            ? "bg-foreground text-background hover:scale-105 active:scale-95"
            : "bg-secondary/70 text-muted-foreground/50",
        )}
      >
        <Square className="w-5 h-5 fill-current" />
      </button>
    </div>
  );
}
