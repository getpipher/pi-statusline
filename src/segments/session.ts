// src/segments/session.ts
export function renderSessionSegment(name: string | undefined): string {
  if (!name) return "";
  return name.trim();
}
