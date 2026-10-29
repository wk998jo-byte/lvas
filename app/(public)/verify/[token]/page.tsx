import type { Metadata } from "next";

import { GateVerificationResult } from "@/components/public/gate-verification-result";
import { getGateVerification } from "@/lib/authorizations/gate-lookup";
import { getI18n } from "@/lib/i18n/server";

// Next 16 without Cache Components: no Full Route/Data cache; every scan runs
// the PostgreSQL lookup. Middleware also sets HTTP/browser no-store headers.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: `${t.public.gate.metaTitle} | LVAS`,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

// The result component reads the locale from the root I18nProvider, so this
// page stays callable without a request scope (scripts/test-gate-verification).
export default async function VerifyAuthorizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getGateVerification(token);
  return <GateVerificationResult result={result} />;
}
