// src/deen/api.ts
const ALADHAN_URL = "https://api.aladhan.com/v1/timingsByCity";

export type PrayerName = "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";

export type PrayerTimes = Record<PrayerName, string>; // "HH:MM" wall clock in the city tz

export interface DeenData {
  prayers: PrayerTimes;
  timezone: string; // IANA name from aladhan meta (e.g. "Asia/Jakarta")
  hijri: string;    // "17 Rabīʿ al-awwal 1448"
}

const PRAYER_NAMES: PrayerName[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseTimingsResponse(body: string): DeenData | null {
  let parsed: { code?: unknown; status?: unknown; data?: any };
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (parsed?.code !== 200 || parsed?.status !== "OK" || !parsed.data) return null;

  const timings = parsed.data.timings as Record<string, unknown> | undefined;
  const timezone = (parsed.data.meta as { timezone?: unknown } | undefined)?.timezone;
  const hijri = (parsed.data.date as { hijri?: any } | undefined)?.hijri;
  if (!timings || typeof timezone !== "string" || !hijri) return null;

  const prayers = {} as PrayerTimes;
  for (const name of PRAYER_NAMES) {
    const value = timings[name];
    if (typeof value !== "string" || !WALL_TIME.test(value)) return null;
    prayers[name] = value;
  }

  const { day, year } = hijri;
  const monthEn = hijri.month?.en;
  if (typeof day !== "string" || typeof year !== "string" || typeof monthEn !== "string") return null;

  return { prayers, timezone, hijri: `${day} ${monthEn} ${year}` };
}

export interface FetchOpts {
  city: string;
  country: string;
  method: string; // "auto" → param omitted (aladhan default)
  fetchImpl?: typeof fetch;
}

export async function fetchPrayerTimes(opts: FetchOpts): Promise<DeenData | null> {
  const params = new URLSearchParams({ city: opts.city, country: opts.country });
  if (opts.method !== "auto") params.set("method", opts.method);
  try {
    const res = await (opts.fetchImpl ?? fetch)(`${ALADHAN_URL}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    return parseTimingsResponse(await res.text());
  } catch {
    return null;
  }
}
