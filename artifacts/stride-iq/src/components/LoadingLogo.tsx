import { cn } from "@/lib/utils";

// The two-orbs-colliding-into-one animation, now the app's shared loading
// indicator (previously a one-off popup animation on the landing page).
export function LoadingLogo({ size = 28, className }: { size?: number; className?: string }) {
  const orbSize = Math.round(size * 0.18);
  const flashSize = Math.round(size * 0.32);
  return (
    <div
      className={cn("relative flex items-center justify-center overflow-visible", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute rounded-full bg-primary"
        style={{
          width: flashSize,
          height: flashSize,
          animation: "loading-logo-flash 2.6s cubic-bezier(0.3,0,0.3,1) infinite",
        }}
      />
      <div
        className="absolute rounded-full bg-primary"
        style={{
          width: orbSize,
          height: orbSize,
          animation: "loading-logo-orb-a 2.6s cubic-bezier(0.45,0,0.2,1) infinite",
        }}
      />
      <div
        className="absolute rounded-full bg-primary/60"
        style={{
          width: orbSize,
          height: orbSize,
          animation: "loading-logo-orb-b 2.6s cubic-bezier(0.45,0,0.2,1) infinite",
        }}
      />
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <LoadingLogo size={56} />
    </div>
  );
}
