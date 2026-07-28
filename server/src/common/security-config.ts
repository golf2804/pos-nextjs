export function parseAllowedOrigins(value: string, production: boolean) {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length) throw new Error("FRONTEND_URL must contain at least one origin.");

  const origins = entries.map((entry) => {
    if (entry === "*") throw new Error("FRONTEND_URL cannot contain a wildcard.");
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(`FRONTEND_URL contains an invalid origin: ${entry}`);
    }
    if (!["http:", "https:"].includes(url.protocol)) {
      throw new Error(`FRONTEND_URL must use HTTP or HTTPS: ${entry}`);
    }
    if (production && url.protocol !== "https:") {
      throw new Error(`FRONTEND_URL must use HTTPS in production: ${entry}`);
    }
    if (production && ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      throw new Error(`FRONTEND_URL cannot use a local host in production: ${entry}`);
    }
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`FRONTEND_URL must be an origin without credentials, path, query, or hash: ${entry}`);
    }
    return url.origin;
  });

  return [...new Set(origins)];
}
