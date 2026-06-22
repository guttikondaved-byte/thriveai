import { useListInjuryAlerts, useAcknowledgeAlert, getListInjuryAlertsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  low: { label: "Low Risk", color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", icon: Shield },
  medium: { label: "Medium Risk", color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/20", icon: AlertTriangle },
  high: { label: "High Risk", color: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/30", icon: ShieldAlert },
  critical: { label: "Critical", color: "text-[#ef4444]", bg: "bg-[#ef4444]/20", border: "border-[#ef4444]/40", icon: ShieldAlert },
};

export default function Alerts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: alerts, isLoading } = useListInjuryAlerts();
  const acknowledge = useAcknowledgeAlert();

  function handleAcknowledge(id: number) {
    acknowledge.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListInjuryAlertsQueryKey() });
        toast({ title: "Alert acknowledged" });
      },
    });
  }

  const active = alerts?.filter(a => !a.acknowledged) ?? [];
  const dismissed = alerts?.filter(a => a.acknowledged) ?? [];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="alerts-title">Injury Risk Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered risk detection based on your training patterns
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {active.length === 0 && dismissed.length === 0 && (
            <div className="bg-card border border-border rounded-lg py-16 text-center">
              <Shield className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">All clear</p>
              <p className="text-xs text-muted-foreground">No injury risks detected. Keep training smart.</p>
            </div>
          )}

          {active.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Active Alerts</h2>
              <div className="space-y-3">
                {active.map(alert => {
                  const cfg = RISK_CONFIG[alert.riskLevel] ?? RISK_CONFIG.low;
                  const Icon = cfg.icon;
                  return (
                    <div key={alert.id} className={`bg-card border rounded-lg p-5 ${cfg.border}`} data-testid={`alert-${alert.id}`}>
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
                      <div className="bg-secondary/50 rounded p-3 mb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recommendation</p>
                        <p className="text-sm text-foreground">{alert.recommendation}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledge.isPending}
                        data-testid={`button-acknowledge-${alert.id}`}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Acknowledge
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dismissed.length > 0 && (
            <div>
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Dismissed</h2>
              <div className="space-y-2">
                {dismissed.map(alert => (
                  <div key={alert.id} className="bg-card border border-border rounded-lg px-5 py-3 opacity-60" data-testid={`alert-dismissed-${alert.id}`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{alert.bodyPart} — {alert.riskLevel} risk</span>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(alert.createdAt), "MMM d")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
