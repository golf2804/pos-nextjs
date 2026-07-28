export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes(String.fromCharCode(92)) || /%5c/i.test(value) || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "https://inventory.internal");
    if (parsed.origin !== "https://inventory.internal") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
