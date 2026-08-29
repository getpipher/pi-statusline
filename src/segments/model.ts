// src/segments/model.ts
export function renderModelSegment(modelId: string | undefined): string {
  if (!modelId) return "no-model";
  const slash = modelId.indexOf("/");
  let name = slash > 0 ? modelId.slice(slash + 1) : modelId;
  // Strip an Ollama-style variant suffix ("glm-5.2:cloud" → "glm-5.2")
  const colon = name.indexOf(":");
  if (colon > 0) name = name.slice(0, colon);
  return name;
}
