import { useRef, useState } from "react";
import { Upload, FileCheck, AlertCircle, X, Loader2 } from "lucide-react";
import { parseGpx, type GpxResult } from "@/lib/parseGpx";
import { Button } from "@/components/ui/button";

interface Props {
  onImport: (data: GpxResult) => void;
  onClose: () => void;
}

export default function GpxImport({ onImport, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsed, setParsed] = useState<GpxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".gpx")) {
      setError("Please upload a .gpx file.");
      return;
    }
    setLoading(true);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseGpx(e.target?.result as string);
        setParsed(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse GPX file.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const fmtPace = (distKm: number, durMin: number) => {
    if (!distKm || !durMin) return "—";
    const paceMin = durMin / distKm;
    const m = Math.floor(paceMin);
    const s = Math.round((paceMin - m) * 60).toString().padStart(2, "0");
    return `${m}:${s} /mi`;
  };

  return (
    <div className="bg-background border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import GPX File</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Upload a .gpx file from Garmin, Apple Watch, or any GPS watch</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={16} />
        </button>
      </div>

      {!parsed && !loading && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg py-10 flex flex-col items-center gap-3 cursor-pointer transition-colors
            ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/40"}`}
        >
          <Upload size={28} className={dragging ? "text-primary" : "text-muted-foreground"} />
          <div className="text-center">
            <p className="text-sm text-foreground font-medium">Drop your .gpx file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
          </div>
          <input ref={inputRef} type="file" accept=".gpx" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Parsing GPX file…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {parsed && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
            <FileCheck size={16} />
            <span className="font-medium">Activity parsed successfully</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Distance" value={`${parsed.distanceKm} mi`} />
            <Stat label="Duration" value={`${parsed.durationMinutes} min`} />
            <Stat label="Pace" value={fmtPace(parsed.distanceKm, parsed.durationMinutes)} />
            <Stat label="Elevation" value={`+${parsed.elevationGainM} m`} />
            {parsed.avgHeartRate && <Stat label="Avg HR" value={`${parsed.avgHeartRate} bpm`} />}
            {parsed.maxHeartRate && <Stat label="Max HR" value={`${parsed.maxHeartRate} bpm`} />}
            {parsed.avgCadence && <Stat label="Cadence" value={`${parsed.avgCadence} spm`} />}
            <Stat label="Date" value={parsed.activityDate} />
          </div>

          {parsed.name && (
            <p className="text-xs text-muted-foreground">Activity name: <span className="text-foreground">{parsed.name}</span></p>
          )}

          <div className="flex gap-3 pt-1">
            <Button
              onClick={() => onImport(parsed)}
              className="bg-primary hover:bg-primary/80 text-[#F5F5F5] font-semibold"
            >
              Save Activity
            </Button>
            <Button variant="outline" onClick={() => { setParsed(null); setError(null); }}>
              Choose Different File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/60 rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
