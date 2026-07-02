import { Shield, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { DEMO_DATA } from "@/lib/demoData";

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  low: { label: "Low Risk", color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", icon: Shield },
  medium: { label: "Medium Risk", color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/20", icon: AlertTriangle },
};

export default function DemoAlerts() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Injury Risk Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-powered risk detection based on your training patterns</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Active Alerts</h2>
        <div className="space-y-3">
          {DEMO_DATA.activeAlerts.map(alert => {
            const cfg = RISK_CONFIG[alert.riskLevel] ?? RISK_CONFIG.low;
            const Icon = cfg.icon;
            return (
              <div key={alert.id} className={`bg-card border rounded-lg p-5 ${cfg.border}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium ${cfg.bg} ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                    <span className="text-sm font-medium text-foreground">{alert.bodyPart}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(alert.createdAt), "MMM d")}</span>
                </div>
                <p className="text-sm text-foreground mb-3">{alert.message}</p>
                <div className="bg-secondary/50 rounded p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recommendation</p>
                  <p className="text-sm text-foreground">{alert.recommendation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Dismissed</h2>
        <div className="space-y-2">
          {DEMO_DATA.dismissedAlerts.map(alert => (
            <div key={alert.id} className="bg-card border border-border rounded-lg px-5 py-3 opacity-60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{alert.bodyPart} — {alert.riskLevel} risk</span>
                <span className="text-xs text-muted-foreground ml-auto">{format(new Date(alert.createdAt), "MMM d")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
