// src/deen/cache.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DeenData } from "./api.ts";

export interface GeoInfo {
  city: string;
  country: string;
  timezone: string;
  fetchedAt: number;
}

export interface DeenCacheFile {
  key: string; // `${city}|${country}|${method}|${local-YYYY-MM-DD}`
  fetchedAt: number;
  data: DeenData;
  geo?: GeoInfo;
}

const DAY_MS = 86_400_000;
const GEO_TTL_MS = 7 * DAY_MS;

export function loadDeenCache(path: string): DeenCacheFile | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as DeenCacheFile;
    if (!parsed || typeof parsed.key !== "string" || !parsed.data) return null;
    return parsed;
  } catch {
    return null; // corrupt cache = cold start, never fatal
  }
}

export function saveDeenCache(path: string, file: DeenCacheFile): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file)}\n`, "utf8");
}

export function isDataFresh(file: DeenCacheFile, key: string, now: number): boolean {
  return file.key === key && now - file.fetchedAt < DAY_MS;
}

export function isGeoFresh(file: DeenCacheFile, now: number): boolean {
  return file.geo !== undefined && now - file.geo.fetchedAt < GEO_TTL_MS;
}
