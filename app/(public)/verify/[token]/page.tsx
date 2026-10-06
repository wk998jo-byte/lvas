import { GateVerificationResult } from "@/components/public/gate-verification-result";
import { getGateVerification } from "@/lib/authorizations/gate-lookup";

// Next 16 without Cache Components: no Full Route/Data cache; every scan runs
// the PostgreSQL lookup. Middleware also sets HTTP/browser no-store headers.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const metadata = {
  title: "Gate verification | LVAS",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function VerifyAuthorizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getGateVerification(token);
  return <GateVerificationResult result={result} />;
}
