// src/deen/source.ts
import { fetchPrayerTimes, type DeenData, type FetchOpts } from "./api.ts";
import { computeSchedule, escalationState, type EscalationState, type PrayerScheduleEntry } from "./time.ts";
import { isDataFresh, isGeoFresh, loadDeenCache, saveDeenCache, type DeenCacheFile, type GeoInfo } from "./cache.ts";

export interface DeenSourceConfig {
  city: string;           // "auto" → IP-geo resolution
  country: string;
  method: string;         // "auto" → aladhan default
  escalateMinutes: number;
}

export interface DeenSnapshot {
  schedule: PrayerScheduleEntry[];
  escalation: EscalationState;
  hijri: string;
  city: string;
  timezone: string;
  staleMinutes: number | null; // null = fresh
}

export interface DeenSource {
  current(): DeenSnapshot | null;
  refresh(force?: boolean): Promise<void>;
  geo(): GeoInfo | null;
}

const GEO_URL = "https://ipwho.is/";

async function defaultFetchGeo(fetchImpl?: typeof fetch): Promise<GeoInfo | null> {
  try {
    const res = await (fetchImpl ?? fetch)(GEO_URL, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { success?: boolean; city?: unknown; country?: unknown; timezone?: { id?: unknown } };
    if (j?.success !== true || typeof j.city !== "string" || typeof j.country !== "string") return null;
    const tz = j.timezone?.id;
    if (typeof tz !== "string") return null;
    return { city: j.city, country: j.country, timezone: tz, fetchedAt: Date.now() };
  } catch {
    return null;
  }
}

// Local YYYY-MM-DD for the cache key (city-date ambiguity is acceptable: the key's
// purpose is daily refetch, and wall-clock math happens in the city tz at render).
function localDateKey(now: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, dateStyle: "short" }).format(new Date(now));
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}

export interface DeenSourceOpts {
  cachePath: string;
  config: () => DeenSourceConfig;
  now?: () => number;
  fetchFn?: FetchOpts["fetchImpl"];
  geoFetchFn?: typeof fetch;
  fetchPrayer?: typeof fetchPrayerTimes;
  fetchGeo?: (fetchImpl?: typeof fetch) => Promise<GeoInfo | null>;
}

export function createDeenSource(opts: DeenSourceOpts): DeenSource {
  const now = opts.now ?? Date.now;
  const fetchPrayer = opts.fetchPrayer ?? fetchPrayerTimes;
  const fetchGeo = opts.fetchGeo ?? defaultFetchGeo;
  let snapshot: DeenSnapshot | null = null;
  let lastKey = "";
  let lastFetchedAt = 0;
  let geo: GeoInfo | null = null;

  // P2-8: a defensive failure (e.g. an invalid IANA timezone reaching Intl inside
  // computeSchedule) yields a null snapshot rather than crashing the render path.
  function toSnapshot(data: DeenData, city: string, staleMinutes: number | null, cfg: DeenSourceConfig): DeenSnapshot | null {
    try {
      const schedule = computeSchedule(data.prayers, now(), data.timezone);
      const minutesUntilNext = schedule.find((e) => e.state === "next" || e.state === "adhan")?.minutesUntil ?? 0;
      return {
        schedule,
        escalation: escalationState(minutesUntilNext, cfg.escalateMinutes),
        hijri: data.hijri,
        city,
        timezone: data.timezone,
        staleMinutes,
      };
    } catch {
      return null;
    }
  }

  return {
    current: () => snapshot,
    geo: () => geo,

    async refresh(force = false): Promise<void> {
      const cfg = opts.config();
      const nowMs = now();
      const cached = loadDeenCache(opts.cachePath);

      // Geo: config city wins; "auto" resolves via IP (7d cache, then refetch).
      let city = cfg.city;
      let country = cfg.country;
      let timezone: string | null = null;
      if (city === "auto") {
        if (cached && isGeoFresh(cached, nowMs)) {
          geo = cached.geo!;
        } else {
          geo = await fetchGeo(opts.geoFetchFn);
        }
        if (!geo) { snapshot = null; return; }
        city = geo.city;
        country = geo.country;
        timezone = geo.timezone;
      }

      // Fetch timezones once for the date key when the city is explicit.
      const keyTz = timezone ?? cached?.data.timezone ?? "UTC";
      const key = `${city}|${country}|${cfg.method}|${localDateKey(nowMs, keyTz)}`;

      if (!force && cached && isDataFresh(cached, key, nowMs)) {
        snapshot = toSnapshot(cached.data, city, null, cfg);
        lastKey = key;
        lastFetchedAt = cached.fetchedAt;
        return;
      }

      const data = await fetchPrayer({ city, country, method: cfg.method, fetchImpl: opts.fetchFn });
      if (data) {
        const file: DeenCacheFile = { key, fetchedAt: nowMs, data, ...(geo ? { geo } : cached?.geo ? { geo: cached.geo } : {}) };
        saveDeenCache(opts.cachePath, file);
        lastKey = key;
        lastFetchedAt = nowMs;
        snapshot = toSnapshot(data, city, null, cfg);
        return;
      }

      // Fetch failed: serve last-good (memory first, then stale file) with a stale marker.
      if (lastKey === key && snapshot) {
        snapshot = { ...snapshot, staleMinutes: Math.floor((nowMs - lastFetchedAt) / 60_000) };
        return;
      }
      if (cached && cached.data.timezone === keyTz) {
        snapshot = toSnapshot(cached.data, city, Math.floor((nowMs - cached.fetchedAt) / 60_000), cfg);
        return;
      }
      snapshot = null;
    },
  };
}
