import { useState } from "react";
import { useListTrainingPlans, useCreateTrainingPlan, getListTrainingPlansQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  active: "text-[#10b981] bg-[#10b981]/10 border border-[#10b981]/20",
  completed: "text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20",
  paused: "text-[#f59e0b] bg-[#f59e0b]/10 border border-[#f59e0b]/20",
};

const schema = z.object({
  name: z.string().min(1, "Required"),
  goal: z.string().min(1, "Required"),
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  weeklyMileage: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function Plans() {
  const [showForm, setShowForm] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: plans, isLoading } = useListTrainingPlans();
  const createPlan = useCreateTrainingPlan();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", goal: "", startDate: format(new Date(), "yyyy-MM-dd"), endDate: "" },
  });

  function onSubmit(values: FormValues) {
    createPlan.mutate({
      data: {
        name: values.name,
        goal: values.goal,
        startDate: values.startDate,
        endDate: values.endDate,
        ...(values.weeklyMileage ? { weeklyMileage: parseFloat(values.weeklyMileage) } : {}),
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTrainingPlansQueryKey() });
        toast({ title: "Training plan created" });
        setShowForm(false);
        form.reset();
      },
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="plans-title">Training Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Your structured training programs</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} data-testid="button-create-plan" className="gap-2">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancel" : "New Plan"}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6" data-testid="form-create-plan">
          <h2 className="text-sm font-medium text-foreground mb-4">Create Training Plan</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Plan Name</FormLabel>
                  <FormControl><Input placeholder="12-Week Marathon Build" data-testid="input-plan-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="goal" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Goal</FormLabel>
                  <FormControl><Input placeholder="Sub-4:00 marathon finish" data-testid="input-plan-goal" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" data-testid="input-plan-start" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" data-testid="input-plan-end" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="weeklyMileage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Weekly Mileage Target (mi)</FormLabel>
                  <FormControl><Input type="number" step="0.1" placeholder="40" data-testid="input-weekly-mileage" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="col-span-2 flex justify-end">
                <Button type="submit" disabled={createPlan.isPending} data-testid="button-submit-plan">
                  {createPlan.isPending ? "Creating..." : "Create Plan"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      ) : !plans?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No training plans yet. Create your first plan to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const start = new Date(plan.startDate);
            const end = new Date(plan.endDate);
            const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 86400));
            const elapsed = Math.max(0, Math.ceil((Date.now() - start.getTime()) / (1000 * 86400)));
            const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));

            return (
              <Link key={plan.id} href={`/plans/${plan.id}`} data-testid={`plan-card-${plan.id}`} className="block bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-foreground">{plan.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium capitalize ${STATUS_COLORS[plan.status] ?? ""}`}>
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{plan.goal}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-6 text-xs text-muted-foreground mb-3">
                  <span>{format(start, "MMM d")} – {format(end, "MMM d, yyyy")}</span>
                  {plan.weeklyMileage && <span>{plan.weeklyMileage} mi/week</span>}
                </div>
                {plan.status === "active" && (
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
