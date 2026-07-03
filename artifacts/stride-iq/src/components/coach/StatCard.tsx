export function StatCard({ label, value, sub, icon: Icon, size = "lg" }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ElementType;
  size?: "lg" | "sm";
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5 mb-3">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </p>
      <p className={`font-display font-extrabold text-foreground tracking-tight ${size === "lg" ? "text-4xl" : "text-2xl"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
