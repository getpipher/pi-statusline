// src/adapters/types.ts
// Provider adapter contract (spec §6). One quota row slot; adapters are pluggable modules.
// D differs per adapter (zai: QuotaResult; openrouter in P3: credits payload).
export interface ProviderRowAdapter<D = unknown> {
  id: string;
  matches(provider: string | undefined): boolean;
  current(): D | null;            // last-good data (poller cache); null = row omitted
  fetch(): Promise<D | null>;     // forced refresh (/statusline refresh)
  render(data: D, dim: boolean): string; // one row line, label-first
  // Usage heat 0..100 for the row tint (accent <70%, warning ≥70%, error ≥90%);
  // absent or null → neutral muted. Optional so trivial adapters can skip it.
  heat?(data: D): number | null;
  start(): void;                  // begin background polling (no-op when unconfigured)
  stop(): void;
}

// Active provider's adapter wins; otherwise the first adapter holding data renders DIMMED
// (A5-refined: the quota row is subscription-scoped, not session-scoped).
export function resolveQuotaAdapter<D>(
  adapters: ProviderRowAdapter<D>[],
  activeProvider: string | undefined,
): ProviderRowAdapter<D> | null {
  const withData = adapters.filter((a) => a.current() !== null);
  return withData.find((a) => a.matches(activeProvider)) ?? withData[0] ?? null;
}
