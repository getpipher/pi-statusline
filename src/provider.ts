// src/provider.ts
export function detectProvider(modelId: string | undefined): string {
  if (!modelId) return "unknown";
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(0, slash) : "unknown";
}

// Pi exposes provider and model id as separate fields. This predicate accepts the
// provider field directly; model ids such as "glm-5.2" carry no provider prefix.
export function isZaiProvider(provider: string | undefined): boolean {
  return provider === "zai";
}
