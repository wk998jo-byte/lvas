import { publicTokenSchema } from "@/lib/validations";

/**
 * Called only by server pages. Never derive the QR origin from browser state or
 * forwarded headers. Missing/unsafe configuration yields no QR in any environment.
 * APP_URL is deliberately read at request time, not baked into a client bundle.
 */
export function buildGateVerificationUrl(
  token: string,
  baseUrl: string | undefined = process.env.APP_URL,
): string | null {
  if (!publicTokenSchema.safeParse({ token }).success || !baseUrl?.trim()) return null;
  try {
    const base = new URL(baseUrl.trim());
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
      return null;
    }
    if (["localhost", "127.0.0.1", "[::1]"].includes(base.hostname.toLowerCase())) return null;
    base.pathname = `${base.pathname.replace(/\/+$/, "")}/verify/${token}`;
    return base.toString();
  } catch {
    return null;
  }
}
