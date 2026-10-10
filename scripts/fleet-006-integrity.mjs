import { createHash } from "node:crypto";
import pg from "pg";

// Preserve PostgreSQL microseconds; the default JS Date parser loses precision.
export const exactPgTypes = {
  getTypeParser(oid, format) {
    return oid === 1184 || oid === 1114 ? value => value : pg.types.getTypeParser(oid, format);
  },
};

function timestamp(value) {
  const iso = new Date(value).toISOString();
  const fraction = typeof value === "string"
    ? value.match(/\.(\d+)(?:Z|[+-]\d{2}(?::?\d{2})?)$/)?.[1] ?? "0"
    : value.getUTCMilliseconds().toString().padStart(3, "0");
  return `${iso.slice(0, 19)}.${fraction.padEnd(6, "0")}Z`;
}

function normalize(value, key = "") {
  if (value instanceof Date) return timestamp(value);
  if (Array.isArray(value)) return value.map(item => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k], k)]));
  }
  if (typeof value === "string" && /_at$/.test(key)) return timestamp(value);
  return value;
}

export function fingerprint(value) {
  return createHash("sha256").update(JSON.stringify(normalize(value))).digest("hex");
}

export function vehicleFingerprint(rows) {
  return fingerprint([...rows].sort((a, b) => a.id.localeCompare(b.id)));
}
