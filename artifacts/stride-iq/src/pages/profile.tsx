import { useGetAthleteProfile, useUpdateAthleteProfile, getGetAthleteProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { HelpCircle, X, TriangleAlert, Trash2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Required"),
  age: z.string().min(1, "Required"),
  weeklyMileageGoal: z.string().min(1, "Required"),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced", "elite"]),
  primaryGoal: z.string().min(1, "Required"),
  restingHeartRate: z.string().min(1, "Required"),
  hrv: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

const coachSchema = z.object({
  name: z.string().min(1, "Required"),
  age: z.string().min(1, "Required"),
  bio: z.string().max(500, "Bio must be under 500 characters"),
});
type CoachFormValues = z.infer<typeof coachSchema>;

type GuideKey = "rhr" | "hrv" | null;

const GUIDES: Record<NonNullable<GuideKey>, { title: string; subtitle: string; steps: { app: string; how: string }[]; tip: string }> = {
  rhr: {
    title: "Finding Your Resting Heart Rate",
    subtitle: "Resting HR (RHR) is your heart rate when fully at rest — ideally measured first thing in the morning before getting out of bed.",
    steps: [
      {
        app: "Garmin Connect",
        how: "Open Garmin Connect app → tap your profile photo → scroll to \"Heart Rate\" → look for \"Resting Heart Rate\" (7-day average shown at the top).",
      },
      {
        app: "Apple Health",
        how: "Open Health app → tap \"Browse\" → search \"Resting Heart Rate\" → view your latest reading or daily average.",
      },
      {
        app: "Polar Flow",
        how: "Open Polar Flow → tap a recent activity → scroll to the Heart Rate section. Or open your watch and check the daily summary.",
      },
      {
        app: "Coros",
        how: "Open the Coros app → tap your profile → Health Data → Heart Rate → Resting HR.",
      },
      {
        app: "Whoop / Oura",
        how: "Both apps display resting HR prominently on the home/recovery screen. Use the value shown for last night.",
      },
    ],
    tip: "If you don't have a tracker, you can measure manually: lie still for 5 minutes after waking, then count your pulse for 60 seconds.",
  },
  hrv: {
    title: "Finding Your HRV Score",
    subtitle: "Heart Rate Variability (HRV) measures the variation in time between heartbeats — a higher HRV generally means better recovery. Scores vary by device and method.",
    steps: [
      {
        app: "Garmin Connect",
        how: "Open Garmin Connect → tap your profile → scroll to \"HRV Status\". Your daily HRV is shown in the HRV Status card. Use the most recent overnight reading.",
      },
      {
        app: "Apple Health + HRV4Training",
        how: "Open Health → Browse → \"Heart Rate Variability\". Apple measures HRV during sleep. Alternatively use the free HRV4Training app for a 1-minute morning reading.",
      },
      {
        app: "Polar Flow",
        how: "Polar measures HRV as part of Nightly Recharge. Open Polar Flow → tap last night's sleep → scroll to Nightly Recharge for your ANS charge score (this correlates to HRV).",
      },
      {
        app: "Whoop",
        how: "Open Whoop → tap the Recovery screen. Your HRV is displayed prominently (ms). Use the overnight reading.",
      },
      {
        app: "Oura Ring",
        how: "Open the Oura app → tap the Readiness or Sleep tab → scroll to HRV. The value is in milliseconds.",
      },
    ],
    tip: "HRV is measured in milliseconds (ms). A typical range is 20–100ms for adults — what matters most is your personal baseline, not comparison to others.",
  },
};

function HelpModal({ guideKey, onClose }: { guideKey: NonNullable<GuideKey>; onClose: () => void }) {
  const guide = GUIDES[guideKey];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-[#0f172a] border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 bg-[#0f172a] border-b border-border px-5 py-4 flex items-start justify-between gap-3 rounded-t-2xl">
          <div>
            <h2 className="text-base font-semibold text-foreground">{guide.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{guide.subtitle}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {guide.steps.map(step => (
            <div key={step.app} className="flex gap-3 bg-secondary/30 border border-border rounded-xl p-3.5">
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">{step.app}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.how}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-2.5 bg-primary/10 border border-primary/20 rounded-xl p-3.5 mt-1">
            <p className="text-xs text-primary/90 leading-relaxed">{guide.tip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ label, guideKey, onHelp }: { label: string; guideKey: GuideKey; onHelp: (k: NonNullable<GuideKey>) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      {guideKey && (
        <button
          type="button"
          onClick={() => onHelp(guideKey)}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="How to find this"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const ready = confirm === "DELETE";

  async function handleDelete() {
    if (!ready) return;
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/account", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Deletion failed — please try again.");
      window.location.href = "/";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#0f172a] border border-red-500/30 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <TriangleAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Delete account</h2>
            <p className="text-sm text-slate-400 mt-0.5">This permanently deletes your account, all runs, plans, and alerts. This cannot be undone.</p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Type <span className="text-red-400 font-bold font-mono">DELETE</span> to confirm
          </label>
          <input
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition"
            placeholder="DELETE"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoFocus
          />
        </div>

        {err && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2.5">
            <p className="text-red-300 text-xs">{err}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!ready || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {loading ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CoachProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile, isLoading } = useGetAthleteProfile();
  const updateProfile = useUpdateAthleteProfile();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const form = useForm<CoachFormValues>({
    resolver: zodResolver(coachSchema),
    defaultValues: { name: "", age: "", bio: "" },
  });

  useEffect(() => {
    if (!profile) return;
    form.reset({
      name: profile.name ?? "",
      age: profile.age != null ? String(profile.age) : "",
      bio: profile.primaryGoal ?? "",
    });
  }, [profile]);

  function onSubmit(values: CoachFormValues) {
    updateProfile.mutate({
      data: {
        name: values.name,
        age: parseInt(values.age),
        primaryGoal: values.bio,
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
    <>
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white">Coach Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Your coaching profile</p>
        </div>

        {/* Profile Card */}
        <div className="bg-[#0d1529] border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl font-bold text-white">
              {profile?.name?.charAt(0)?.toUpperCase() ?? "C"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{profile?.name ?? "Coach"}</p>
              <p className="text-xs text-cyan-400 font-medium uppercase tracking-wider">Thrive Coach</p>
              <p className="text-xs text-slate-500 mt-0.5">{profile?.email ?? ""}</p>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs text-slate-400 font-medium uppercase tracking-wider">Name</FormLabel>
                    <FormControl>
                      <Input className="bg-[#0a0f1e] border-slate-800 text-white placeholder-slate-600" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="age" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-slate-400 font-medium uppercase tracking-wider">Age</FormLabel>
                    <FormControl>
                      <Input type="number" className="bg-[#0a0f1e] border-slate-800 text-white placeholder-slate-600" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-slate-400 font-medium uppercase tracking-wider">Coaching Bio</FormLabel>
                  <FormControl>
                    <textarea
                      className="w-full bg-[#0a0f1e] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 min-h-[80px] resize-y"
                      placeholder="Describe your coaching philosophy, specialties, and experience..."
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold"
                >
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-5">
          <div className="flex items-center gap-2 mb-1">
            <TriangleAlert className="w-4 h-4 text-red-400" />
            <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">Once you delete your account, all your runs, training plans, alerts, and data are permanently gone. There is no undo.</p>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 text-sm font-semibold transition-all"
          >
            <Trash2 size={14} />
            Delete account
          </button>
        </div>
      </div>
    </>
  );
}

function AthleteProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile, isLoading } = useGetAthleteProfile();
  const updateProfile = useUpdateAthleteProfile();
  const [activeGuide, setActiveGuide] = useState<GuideKey>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
        age: parseInt(values.age),
        weeklyMileageGoal: parseFloat(values.weeklyMileageGoal),
        restingHeartRate: parseInt(values.restingHeartRate),
        hrv: parseFloat(values.hrv),
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
    <>
      {activeGuide && <HelpModal guideKey={activeGuide} onClose={() => setActiveGuide(null)} />}
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}

      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8 border-b border-border pb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight" data-testid="profile-title">Athlete Profile</h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium">Your training profile and physiological metrics</p>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
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
                      <FormLabel>Age <span className="text-red-400">*</span></FormLabel>
                      <FormControl><Input type="number" data-testid="input-age" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="fitnessLevel" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fitness Level <span className="text-red-400">*</span></FormLabel>
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
                      <FormLabel>Primary Goal <span className="text-red-400">*</span></FormLabel>
                      <FormControl><Input placeholder="Sub-4:00 marathon finish" data-testid="input-goal" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="weeklyMileageGoal" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weekly Distance Goal (mi) <span className="text-red-400">*</span></FormLabel>
                      <FormControl><Input type="number" step="0.1" data-testid="input-weekly-goal" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="restingHeartRate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <FieldLabel label="Resting HR (bpm)" guideKey="rhr" onHelp={setActiveGuide} />
                      </FormLabel>
                      <FormControl><Input type="number" data-testid="input-rhr" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="hrv" render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>
                        <FieldLabel label="HRV Score (ms)" guideKey="hrv" onHelp={setActiveGuide} />
                      </FormLabel>
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

          {/* Danger Zone */}
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-5">
            <div className="flex items-center gap-2 mb-1">
              <TriangleAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Danger Zone</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Once you delete your account, all your runs, training plans, alerts, and data are permanently gone. There is no undo.</p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 text-sm font-semibold transition-all"
            >
              <Trash2 size={14} />
              Delete account
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function Profile() {
  const { data: profile, isLoading } = useGetAthleteProfile();
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
  return profile?.userRole === "coach" ? <CoachProfile /> : <AthleteProfile />;
}
