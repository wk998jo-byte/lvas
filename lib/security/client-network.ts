import { isIP } from "node:net";

export type ClientNetwork = { identifier: string; trusted: boolean };

/**
 * Next Server Actions do not expose a socket peer. Replit documents forwarded
 * IP headers but does not publish a verifiable proxy trust boundary.
 * Default: ignore them and use a shared fallback, never fail open.
 * Only enable RATE_LIMIT_TRUST_PROXY_HEADERS after an operator independently
 * verifies that the ingress strips/overwrites client-supplied IP headers.
 * This task does not enable that setting or change deployment configuration.
 */
export function clientNetwork(headerStore: Pick<Headers, "get">): ClientNetwork {
  if (process.env.RATE_LIMIT_TRUST_PROXY_HEADERS !== "true") {
    return { identifier: "unverified-network", trusted: false };
  }
  const candidate = (
    headerStore.get("x-real-ip")
    ?? headerStore.get("x-forwarded-for")?.split(",").at(-1)
    ?? ""
  ).trim().toLowerCase();
  const version = isIP(candidate);
  if (!version) return { identifier: "unverified-network", trusted: false };
  // Canonicalize IPv6 spellings and group /64s to prevent trivial suffix rotation.
  let identifier = version === 6
    ? new URL(`http://[${candidate}]/`).hostname.slice(1, -1)
    : candidate;
  if (version === 6) {
    const [head, tail] = identifier.split("::");
    const left = head.split(":").filter(Boolean);
    const right = (tail ?? "").split(":").filter(Boolean);
    const groups = tail === undefined
      ? left
      : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
    identifier = `${groups.slice(0, 4).map((group) => group.padStart(4, "0")).join(":")}::/64`;
  }
  return { identifier, trusted: true };
}
