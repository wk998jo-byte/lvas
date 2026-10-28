import { LanguageSwitch } from "@/components/i18n/language-switch";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed top-4 end-4 z-50">
        <LanguageSwitch />
      </div>
      {children}
    </>
  );
}
