import { useGetAthleteProfile, useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(1, "Required"),
  age: z.string().optional(),
  weeklyMileageGoal: z.string().optional(),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  primaryGoal: z.string().min(1, "Required"),
  restingHeartRate: z.string().optional(),
  hrv: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function Profile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile, isLoading } = useGetAthleteProfile();
  const updateProfile = useUpdateAthleteProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", age: "", weeklyMileageGoal: "",
      fitnessLevel: "intermediate", primaryGoal: "",
      restingHeartRate: "", hrv: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        age: profile.age != null ? String(profile.age) : "",
        weeklyMileageGoal: profile.weeklyMileageGoal != null ? String(profile.weeklyMileageGoal) : "",
        fitnessLevel: profile.fitnessLevel as FormValues["fitnessLevel"],
        primaryGoal: profile.primaryGoal,
        restingHeartRate: profile.restingHeartRate != null ? String(profile.restingHeartRate) : "",
        hrv: profile.hrv != null ? String(profile.hrv) : "",
      });
    }
  }, [profile]);

  function onSubmit(values: FormValues) {
    updateProfile.mutate({
      data: {
        name: values.name,
        fitnessLevel: values.fitnessLevel,
        primaryGoal: values.primaryGoal,
        ...(values.age ? { age: parseInt(values.age) } : {}),
        ...(values.weeklyMileageGoal ? { weeklyMileageGoal: parseFloat(values.weeklyMileageGoal) } : {}),
        ...(values.restingHeartRate ? { restingHeartRate: parseInt(values.restingHeartRate) } : {}),
        ...(values.hrv ? { hrv: parseFloat(values.hrv) } : {}),
      }
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetAthleteProfileQueryKey() });
        toast({ title: "Profile updated" });
      },
    });
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-32 bg-card border border-border rounded animate-pulse mb-8" />
        <div className="max-w-xl space-y-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="profile-title">Athlete Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your training profile and physiological metrics</p>
      </div>

      <div className="max-w-xl">
        <div className="bg-card border border-border rounded-lg p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl><Input data-testid="input-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl><Input type="number" data-testid="input-age" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fitnessLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fitness Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-fitness-level">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="elite">Elite</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="primaryGoal" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Primary Goal</FormLabel>
                    <FormControl><Input placeholder="Sub-4:00 marathon finish" data-testid="input-goal" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="weeklyMileageGoal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weekly Distance Goal (km)</FormLabel>
                    <FormControl><Input type="number" step="0.1" data-testid="input-weekly-goal" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="restingHeartRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resting HR (bpm)</FormLabel>
                    <FormControl><Input type="number" data-testid="input-rhr" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="hrv" render={({ field }) => (
                  <FormItem>
                    <FormLabel>HRV Score</FormLabel>
                    <FormControl><Input type="number" step="0.1" data-testid="input-hrv" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={updateProfile.isPending} data-testid="button-save-profile">
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
