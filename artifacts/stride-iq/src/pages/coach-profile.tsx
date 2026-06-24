import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Plus, X, Trash2, TriangleAlert } from "lucide-react";

interface CoachProfile {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  certifications: Array<{ title: string; issuer: string; year: number }>;
  experience: number | null;
  specialties: string[];
  teamsManaged: number;
  athletesCached: number;
}

const specialtyOptions = [
  "Track",
  "Cross Country",
  "Marathon",
  "Half Marathon",
  "Trail Running",
  "Road Running",
  "Sprinting",
  "Distance Running",
  "Beginners",
  "Fitness",
];

const certificationSchema = z.object({
  title: z.string().min(1, "Title required"),
  issuer: z.string().min(1, "Issuer required"),
  year: z.number().min(2000).max(new Date().getFullYear()),
});

const formSchema = z.object({
  bio: z.string().max(500, "Bio must be under 500 characters").optional().or(z.literal("")),
  experience: z.number().optional(),
  specialties: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const { signOut } = useClerk();

  async function handleDelete() {
    if (!confirm) return;
    setLoading(true);
    setErr("");
    let deleted = false;
    try {
      const res = await fetch("/api/account", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Deletion failed — please try again.");
      deleted = true;
      await signOut({ redirectUrl: "/" });
    } catch (e: unknown) {
      if (deleted) {
        window.location.href = "/";
        return;
      }
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#06070E] border border-red-500/30 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
            <TriangleAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Delete account</h2>
            <p className="text-sm text-slate-400 mt-0.5">This permanently deletes your account, all teams, and athlete data. This cannot be undone.</p>
          </div>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-5 group">
          <input
            type="checkbox"
            checked={confirm}
            onChange={e => setConfirm(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 accent-red-500 cursor-pointer shrink-0"
          />
          <span className="text-sm text-slate-300 leading-snug group-hover:text-white transition-colors">
            I understand this is permanent and cannot be undone
          </span>
        </label>

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
            disabled={!confirm || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CoachProfilePage() {
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [newCert, setNewCert] = useState({ title: "", issuer: "", year: new Date().getFullYear() });
  const [certifications, setCertifications] = useState<Array<{ title: string; issuer: string; year: number }>>([]);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bio: "",
      experience: undefined,
      specialties: [],
    },
  });

  useEffect(() => {
    fetchCoachProfile();
  }, []);

  async function fetchCoachProfile() {
    try {
      const res = await fetch("/api/coach/profile", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setCoachProfile(data);
      setCertifications(data.certifications || []);
      form.reset({
        bio: data.bio || "",
        experience: data.experience || undefined,
        specialties: data.specialties || [],
      });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/coach/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bio: values.bio || null,
          experience: values.experience,
          specialties: values.specialties,
          certifications,
        }),
      });

      if (!res.ok) throw new Error("Failed to save profile");
      await res.json();
      toast({ title: "Profile updated successfully" });
      await fetchCoachProfile();
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  const addCertification = () => {
    if (!newCert.title || !newCert.issuer) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }
    setCertifications([...certifications, newCert]);
    setNewCert({ title: "", issuer: "", year: new Date().getFullYear() });
  };

  const removeCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  const toggleSpecialty = (specialty: string) => {
    const current = form.getValues("specialties");
    if (current.includes(specialty)) {
      form.setValue("specialties", current.filter(s => s !== specialty));
    } else {
      form.setValue("specialties", [...current, specialty]);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-32 bg-card border border-border rounded animate-pulse mb-8" />
        <div className="max-w-2xl space-y-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  const fullName = `${coachProfile?.firstName || ""} ${coachProfile?.lastName || ""}`.trim() || "Coach";

  return (
    <>
      {showDeleteModal && <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />}
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-white">Coach Profile</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your coaching profile and credentials</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-[#0e1a19] border-border p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Teams</p>
            <p className="text-2xl font-bold text-white mt-2">{coachProfile?.teamsManaged ?? 0}</p>
          </Card>
          <Card className="bg-[#0e1a19] border-border p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Athletes</p>
            <p className="text-2xl font-bold text-white mt-2">{coachProfile?.athletesCached ?? 0}</p>
          </Card>
          <Card className="bg-[#0e1a19] border-border p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Experience</p>
            <p className="text-2xl font-bold text-white mt-2">{coachProfile?.experience ?? 0} yrs</p>
          </Card>
        </div>

        {/* Profile Info Card */}
        <Card className="bg-[#0e1a19] border-border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#2A504C] to-[#3d7a74] flex items-center justify-center text-2xl font-bold text-white">
              {fullName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{fullName}</p>
              <p className="text-xs text-primary font-medium uppercase tracking-wider">Thrive Coach</p>
              <p className="text-xs text-slate-500 mt-0.5">{coachProfile?.email}</p>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Bio */}
            <Card className="bg-[#0e1a19] border-border p-6">
              <h2 className="text-lg font-semibold text-white mb-4">About</h2>
              <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Tell athletes about yourself, your coaching philosophy, and experience..."
                      className="bg-[#06070E] border-border text-white min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </Card>

            {/* Experience */}
            <Card className="bg-[#0e1a19] border-border p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Experience</h2>
              <FormField control={form.control} name="experience" render={({ field }) => (
                <FormItem>
                  <FormLabel>Years of Coaching</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="70"
                      placeholder="0"
                      className="bg-[#06070E] border-border text-white"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </Card>

            {/* Specialties */}
            <Card className="bg-[#0e1a19] border-border p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Specialties</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {specialtyOptions.map((specialty) => {
                  const isSelected = form.getValues("specialties").includes(specialty);
                  return (
                    <button
                      key={specialty}
                      type="button"
                      onClick={() => toggleSpecialty(specialty)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-primary text-white border border-primary"
                          : "bg-[#06070E] border border-border text-slate-400 hover:text-white hover:border-slate-600"
                      }`}
                    >
                      {specialty}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Certifications */}
            <Card className="bg-[#0e1a19] border-border p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Certifications</h2>

              {/* Existing Certifications */}
              <div className="space-y-2 mb-4">
                {certifications.map((cert, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-[#06070E] border border-border rounded-lg">
                    <div>
                      <p className="font-medium text-white">{cert.title}</p>
                      <p className="text-xs text-slate-500">{cert.issuer} · {cert.year}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCertification(index)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Certification */}
              <div className="space-y-3 p-4 bg-[#06070E] border border-border rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Cert. title (e.g., USATF Level 2)"
                    value={newCert.title}
                    onChange={(e) => setNewCert({ ...newCert, title: e.target.value })}
                    className="bg-[#0a0f0e] border-border text-white"
                  />
                  <Input
                    placeholder="Issuer (e.g., USATF)"
                    value={newCert.issuer}
                    onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                    className="bg-[#0a0f0e] border-border text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="2000"
                    max={new Date().getFullYear()}
                    placeholder="Year"
                    value={newCert.year}
                    onChange={(e) => setNewCert({ ...newCert, year: parseInt(e.target.value) })}
                    className="bg-[#0a0f0e] border-border text-white flex-1"
                  />
                  <Button
                    type="button"
                    onClick={addCertification}
                    className="bg-primary hover:bg-primary/80 text-white px-3"
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-primary hover:bg-primary/80 text-white"
              >
                {saving ? "Saving..." : "Save Profile"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
