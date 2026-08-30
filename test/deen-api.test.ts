// test/deen-api.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTimingsResponse } from "../src/deen/api.ts";

const FIXTURE = JSON.stringify({
  code: 200,
  status: "OK",
  data: {
    timings: {
      Fajr: "04:36", Sunrise: "05:54", Dhuhr: "11:53", Asr: "15:11",
      Sunset: "17:53", Maghrib: "17:53", Isha: "19:03", Imsak: "04:26",
      Midnight: "23:53", Firstthird: "22:23", Lastthird: "01:23",
    },
    date: {
      readable: "30 Aug 2026",
      timestamp: "1786622400",
      gregorian: { date: "30-08-2026" },
      hijri: {
        date: "17-02-1448", day: "17",
        month: { number: 2, en: "Rabīʿ al-awwal", ar: "رَبيع الأوّل" },
        year: "1448",
      },
    },
    meta: { latitude: -6.2, longitude: 106.8, timezone: "Asia/Jakarta" },
  },
});

test("parseTimingsResponse extracts the five prayers, timezone and hijri", () => {
  const data = parseTimingsResponse(FIXTURE);
  assert.deepEqual(data, {
    prayers: { Fajr: "04:36", Dhuhr: "11:53", Asr: "15:11", Maghrib: "17:53", Isha: "19:03" },
    timezone: "Asia/Jakarta",
    hijri: "17 Rabīʿ al-awwal 1448",
  });
});

test("parseTimingsResponse returns null on bad JSON, wrong code, or missing fields", () => {
  assert.equal(parseTimingsResponse("not-json"), null);
  assert.equal(parseTimingsResponse(JSON.stringify({ code: 404, status: "KO" })), null);
  assert.equal(parseTimingsResponse(JSON.stringify({ code: 200, status: "OK", data: { timings: {} } })), null);
  const noTz = JSON.parse(FIXTURE) as { data: { meta: unknown } };
  delete noTz.data.meta;
  assert.equal(parseTimingsResponse(JSON.stringify(noTz)), null);
  const badTime = JSON.parse(FIXTURE) as { data: { timings: Record<string, string> } };
  badTime.data.timings.Dhuhr = "113X"; // malformed wall time
  assert.equal(parseTimingsResponse(JSON.stringify(badTime)), null);
});
