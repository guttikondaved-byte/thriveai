export interface GpxResult {
  name: string | null;
  activityDate: string;
  distanceKm: number;
  durationMinutes: number;
  elevationGainM: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgCadence: number | null;
  suggestedType: string;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getText(el: Element | null, tag: string): string | null {
  if (!el) return null;
  const found = el.querySelector(tag);
  return found?.textContent?.trim() ?? null;
}

function suggestType(distanceKm: number, durationMinutes: number): string {
  const pace = durationMinutes / distanceKm;
  if (distanceKm >= 21) return "long_run";
  if (distanceKm >= 10) return "long_run";
  if (pace < 4.5) return "interval";
  if (pace < 5.2) return "tempo_run";
  return "easy_run";
}

export function parseGpx(xmlText: string): GpxResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Invalid GPX file");

  const name = getText(doc.documentElement, "name");

  const trkpts = Array.from(doc.querySelectorAll("trkpt"));
  if (trkpts.length < 2) throw new Error("GPX file has no track points");

  let distanceKm = 0;
  let elevationGainM = 0;
  let prevLat: number | null = null;
  let prevLon: number | null = null;
  let prevEle: number | null = null;
  const hrValues: number[] = [];
  const cadValues: number[] = [];
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  for (const pt of trkpts) {
    const lat = parseFloat(pt.getAttribute("lat") ?? "");
    const lon = parseFloat(pt.getAttribute("lon") ?? "");
    const eleText = getText(pt, "ele");
    const ele = eleText !== null ? parseFloat(eleText) : null;
    const timeText = getText(pt, "time");
    const t = timeText ? new Date(timeText) : null;

    if (!isNaN(lat) && !isNaN(lon)) {
      if (prevLat !== null && prevLon !== null) {
        distanceKm += haversineKm(prevLat, prevLon, lat, lon);
      }
      prevLat = lat;
      prevLon = lon;
    }

    if (ele !== null && !isNaN(ele)) {
      if (prevEle !== null && ele > prevEle) elevationGainM += ele - prevEle;
      prevEle = ele;
    }

    if (t && !isNaN(t.getTime())) {
      if (!startTime) startTime = t;
      endTime = t;
    }

    const hrEl =
      pt.querySelector("hr") ??
      pt.querySelector("gpxtpx\\:hr") ??
      pt.querySelector("[localName='hr']");
    if (hrEl?.textContent) {
      const v = parseInt(hrEl.textContent);
      if (!isNaN(v) && v > 30 && v < 250) hrValues.push(v);
    }

    const cadEl =
      pt.querySelector("cad") ??
      pt.querySelector("gpxtpx\\:cad") ??
      pt.querySelector("[localName='cad']");
    if (cadEl?.textContent) {
      const v = parseInt(cadEl.textContent);
      if (!isNaN(v) && v > 0) cadValues.push(v);
    }
  }

  const durationMinutes =
    startTime && endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
      : 0;

  const activityDate = startTime
    ? startTime.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const avgHeartRate =
    hrValues.length > 0
      ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length)
      : null;

  const maxHeartRate = hrValues.length > 0 ? Math.max(...hrValues) : null;

  const avgCadence =
    cadValues.length > 0
      ? Math.round(cadValues.reduce((a, b) => a + b, 0) / cadValues.length)
      : null;

  return {
    name,
    activityDate,
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationMinutes,
    elevationGainM: Math.round(elevationGainM),
    avgHeartRate,
    maxHeartRate,
    avgCadence,
    suggestedType: suggestType(distanceKm, durationMinutes),
  };
}
