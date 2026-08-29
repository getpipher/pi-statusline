// src/provider.ts
export function detectProvider(modelId: string | undefined): string {
  if (!modelId) return "unknown";
  const slash = modelId.indexOf("/");
  return slash > 0 ? modelId.slice(0, slash) : "unknown";
}

// The active GLM Coding Plan session runs on provider "zai" (pi defaultProvider),
// NOT the Ollama cloud proxy ("Ollama/glm-5.2:cloud"). This drives A5 quota dimming:
// quota is bright when the session actually draws on the z.ai plan.
export function isZaiProvider(modelId: string | undefined): boolean {
  return detectProvider(modelId) === "zai";
}
