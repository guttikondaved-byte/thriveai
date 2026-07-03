export function Eyebrow({ children, accent = false, className = "" }: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <p className={`font-display font-semibold text-[11px] uppercase tracking-[0.08em] ${accent ? "text-primary" : "text-muted-foreground"} ${className}`}>
      {children}
    </p>
  );
}

export function PageHeader({ eyebrow, title, meta, action }: {
  eyebrow: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <Eyebrow accent>{eyebrow}</Eyebrow>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground mt-1.5">{title}</h1>
        {meta && <p className="text-sm text-muted-foreground mt-1">{meta}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
