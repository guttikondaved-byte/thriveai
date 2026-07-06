import { InjuryRiskView } from "@/pages/coach-athlete-injury-risk";
import { getDemoInjuryRiskDashboard, DEMO_COACH_DATA } from "@/lib/demoData";

export default function DemoCoachAthleteInjuryRisk({ params }: { params: { userId: string } }) {
  const dashboard = getDemoInjuryRiskDashboard(params.userId);
  const member = DEMO_COACH_DATA.roster.find(m => m.userId === params.userId);

  return (
    <InjuryRiskView
      dashboard={dashboard}
      athleteName={member?.name ?? "Athlete"}
      loading={false}
      error={dashboard ? null : "Athlete not found."}
      backHref={`/demo-coach/athletes/${params.userId}`}
      demo
    />
  );
}
