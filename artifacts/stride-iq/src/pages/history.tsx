import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInjuries,
  useCreateInjury,
  useUpdateInjury,
  useDeleteInjury,
  useGetAthleteProfile,
  useUpdateAthleteProfile,
  getListInjuriesQueryKey,
} from "@workspace/api-client-react";
import type { Injury, InjuryInput } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Check, X, Shield, Trophy, FileText } from "lucide-react";
import { BODY_PARTS } from "@/lib/bodyParts";

type Tab = "records" | "injuries" | "notes";

const INJURY_TYPES = [
  "Strain", "Sprain", "Tendinitis", "Stress Fracture", "Bursitis",
  "Runner's Knee", "Shin Splints", "IT Band Syndrome", "Plantar Fasciitis", "Other",
];

function PRCard({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = () => {
    onChange(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3 shadow-sm transition-all hover:shadow-md">
      <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{label}</p>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. 22:30"
            autoFocus
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          />
          <button onClick={commit} className="text-emerald-600 hover:text-emerald-300 p-1.5 bg-emerald-400/10 rounded-md transition-colors"><Check className="w-4 h-4" /></button>
          <button onClick={cancel} className="text-muted-foreground hover:text-foreground p-1.5 bg-secondary rounded-md transition-colors"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-foreground tracking-tight">
            {value || <span className="text-muted-foreground/50 text-sm font-normal italic">Not set</span>}
          </span>
          <button onClick={() => { setDraft(value); setEditing(true); }} className="text-muted-foreground hover:text-primary p-2 rounded-full hover:bg-primary/10 transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

type InjuryFormData = {
  injuryType: string;
  bodyPart: string;
  dateOccurred: string;
  dateRecovered: string;
  status: "active" | "recovered";
  notes: string;
};

const emptyForm: InjuryFormData = {
  injuryType: "",
  bodyPart: "",
  dateOccurred: new Date().toISOString().split("T")[0],
  dateRecovered: "",
  status: "active",
  notes: "",
};

function InjuryForm({ initial, onSubmit, onCancel }: {
  initial?: InjuryFormData;
  onSubmit: (data: InjuryInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<InjuryFormData>(initial ?? emptyForm);
  const set = (k: keyof InjuryFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.injuryType || !form.bodyPart || !form.dateOccurred) return;
    const payload: InjuryInput = {
      injuryType: form.injuryType,
      bodyPart: form.bodyPart,
      dateOccurred: form.dateOccurred,
      status: form.status,
      ...(form.dateRecovered && { dateRecovered: form.dateRecovered }),
      ...(form.notes && { notes: form.notes }),
    };
    onSubmit(payload);
  };

  const inputCls = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "text-xs text-muted-foreground mb-1 block";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Injury Type *</label>
          <select className={inputCls} value={form.injuryType} onChange={set("injuryType")} required>
            <option value="">Select type…</option>
            {INJURY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Body Part *</label>
          <select className={inputCls} value={form.bodyPart} onChange={set("bodyPart")} required>
            <option value="">Select area…</option>
            {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Date Occurred *</label>
          <input type="date" className={inputCls} value={form.dateOccurred} onChange={set("dateOccurred")} required />
        </div>
        <div>
          <label className={labelCls}>Date Recovered</label>
          <input type="date" className={inputCls} value={form.dateRecovered} onChange={set("dateRecovered")} />
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={set("status")}>
            <option value="active">Active</option>
            <option value="recovered">Recovered</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          value={form.notes}
          onChange={set("notes")}
          placeholder="Any additional context…"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          Cancel
        </button>
        <button type="submit"
          className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
          Save
        </button>
      </div>
    </form>
  );
}

export default function History() {
  const [tab, setTab] = useState<Tab>("records");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notesText, setNotesText] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profile, isLoading: profileLoading } = useGetAthleteProfile();
  // Captured here (before any narrowing) so the fallback cast below doesn't
  // collapse to `undefined` — `typeof profile` inline inside `profile ?? (...)`
  // gets control-flow-narrowed to just "undefined" on that branch, which
  // can't be cast from `{}`. Naming the type first avoids that.
  type ProfileData = typeof profile;
  const { data: injuries = [], isLoading: injuriesLoading } = useListInjuries();

  const updateProfile = useUpdateAthleteProfile({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["getAthleteProfile"] });
        toast({ title: "Saved" });
        setSavingNotes(false);
      },
      onError: () => { setSavingNotes(false); toast({ title: "Save failed", variant: "destructive" }); },
    },
  });

  const createInjury = useCreateInjury({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInjuriesQueryKey() }); setShowForm(false); toast({ title: "Injury logged" }); },
      onError: () => toast({ title: "Error saving", variant: "destructive" }),
    },
  });

  const updateInjury = useUpdateInjury({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInjuriesQueryKey() }); setEditingId(null); toast({ title: "Updated" }); },
      onError: () => toast({ title: "Error updating", variant: "destructive" }),
    },
  });

  const deleteInjury = useDeleteInjury({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListInjuriesQueryKey() }); toast({ title: "Deleted" }); },
      onError: () => toast({ title: "Error deleting", variant: "destructive" }),
    },
  });

  const savePR = (field: "pr5k" | "pr10k" | "prHalf" | "prMarathon") => (value: string) => {
    updateProfile.mutate({ data: { [field]: value } });
  };

  const saveNotes = () => {
    setSavingNotes(true);
    updateProfile.mutate({ data: { healthNotes: notesText ?? "" } });
  };

  const pr = profile ?? ({} as ProfileData);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "records", label: "Personal Records", icon: <Trophy className="w-4 h-4" /> },
    { id: "injuries", label: "Injury Log", icon: <Shield className="w-4 h-4" /> },
    { id: "notes", label: "Health Notes", icon: <FileText className="w-4 h-4" /> },
  ];

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary">Health</p>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground mt-1.5">Health & History</h1>
        <p className="text-muted-foreground text-sm mt-1.5">Your personal records, injury history, and health notes</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border pb-px">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
              tab === t.id
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Personal Records Tab */}
      {tab === "records" && (
        <div>
          <p className="text-sm text-muted-foreground mb-4">Click the edit icon on any card to update your PR. Format: MM:SS or H:MM:SS</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PRCard label="5K" value={pr?.pr5k ?? ""} onChange={savePR("pr5k")} />
            <PRCard label="10K" value={pr?.pr10k ?? ""} onChange={savePR("pr10k")} />
            <PRCard label="Half Marathon" value={pr?.prHalf ?? ""} onChange={savePR("prHalf")} />
            <PRCard label="Marathon" value={pr?.prMarathon ?? ""} onChange={savePR("prMarathon")} />
          </div>
        </div>
      )}

      {/* Injury Log Tab */}
      {tab === "injuries" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{injuries.length} {injuries.length === 1 ? "injury" : "injuries"} logged</p>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Log Injury
              </button>
            )}
          </div>

          {showForm && (
            <div className="bg-secondary/20 border border-border rounded-xl p-4 mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Log New Injury</h3>
              <InjuryForm
                onSubmit={data => createInjury.mutate({ data })}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {injuriesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : injuries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Shield className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No injuries logged yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tracking injuries helps AveraAI give safer training advice</p>
            </div>
          ) : (
            <div className="space-y-3">
              {injuries.map((injury: Injury) => (
                <div key={injury.id} className="bg-secondary/20 border border-border rounded-xl p-4">
                  {editingId === injury.id ? (
                    <InjuryForm
                      initial={{
                        injuryType: injury.injuryType,
                        bodyPart: injury.bodyPart,
                        dateOccurred: injury.dateOccurred,
                        dateRecovered: injury.dateRecovered ?? "",
                        status: injury.status as "active" | "recovered",
                        notes: injury.notes ?? "",
                      }}
                      onSubmit={data => updateInjury.mutate({ id: injury.id, data })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-foreground text-sm">{injury.injuryType}</span>
                          <span className="text-muted-foreground text-xs">·</span>
                          <span className="text-sm text-muted-foreground">{injury.bodyPart}</span>
                          <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            injury.status === "active"
                              ? "bg-red-500/15 text-red-600 border border-red-500/20"
                              : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/20"
                          }`}>
                            {injury.status === "active" ? "Active" : "Recovered"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {injury.dateOccurred}
                          {injury.dateRecovered && ` → ${injury.dateRecovered}`}
                        </p>
                        {injury.notes && (
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">{injury.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setEditingId(injury.id)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Delete this injury record?")) {
                              deleteInjury.mutate({ id: injury.id });
                            }
                          }}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Health Notes Tab */}
      {tab === "notes" && (
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Freeform health notes: allergies, chronic conditions, medications, sleep habits, dietary info. AveraAI uses this context when coaching you.
          </p>
          <textarea
            className="w-full bg-secondary/20 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={10}
            placeholder="e.g. Asthma managed with inhaler. Lactose intolerant. Usually sleep 7 hrs. Had knee surgery in 2022…"
            defaultValue={profile?.healthNotes ?? ""}
            onChange={e => setNotesText(e.target.value)}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {savingNotes ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Notes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
