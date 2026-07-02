import { useLocation } from "wouter";
import { User, Users, Footprints, ArrowRight } from "lucide-react";

const OPTIONS = [
  {
    id: "athlete",
    Icon: User,
    label: "Athlete",
    desc: "Track training, monitor injury risk, and chat with an AI coach.",
    features: ["Personal dashboard & activity log", "AveraAI coach", "Injury risk & intensity map", "Training plans"],
    href: "/demo",
  },
  {
    id: "coach",
    Icon: Users,
    label: "Coach",
    desc: "Manage a team of athletes and monitor their workload and health.",
    features: ["Athlete roster & risk overview", "Team-wide training plans", "AveraAI coaching assistant", "Injury risk alerts"],
    href: "/demo-coach",
  },
];

export default function DemoChoose() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
            <Footprints className="w-7 h-7 text-primary" />
          </div>
          <img src="/logo.svg" alt="Thrive" className="h-7 w-auto mb-5" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Try the demo</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
            See Thrive from either side — no signup required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => navigate(opt.href)}
              className="text-left rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-primary/40 hover:bg-secondary/30 hover:shadow-sm"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <opt.Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-medium text-foreground">{opt.label}</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed mb-4">{opt.desc}</p>
              <ul className="space-y-1.5 mb-5">
                {opt.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Explore as {opt.label.toLowerCase()} <ArrowRight className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate("/")}
          className="mt-8 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to site
        </button>
      </div>
    </div>
  );
}
