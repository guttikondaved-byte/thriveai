import { useLocation } from "wouter";
import { AthleteDetailView } from "@/pages/coach-athlete";
import { getDemoAthleteDetail } from "@/lib/demoData";

export default function DemoCoachAthleteDetail({ params }: { params: { userId: string } }) {
  const [, navigate] = useLocation();
  const data = getDemoAthleteDetail(params.userId);

  if (!data) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-sm text-muted-foreground">Athlete not found.</p>
        <button
          onClick={() => navigate("/demo-coach")}
          className="mt-4 py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <AthleteDetailView
      data={data}
      onBack={() => navigate("/demo-coach")}
      injuryRiskHref={`/demo-coach/athletes/${data.userId}/injury-risk`}
      demo
    />
  );
}
