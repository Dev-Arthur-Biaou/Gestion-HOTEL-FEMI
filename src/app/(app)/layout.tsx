import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ensureReady } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/stays";
import { AppShell } from "@/components/app-shell";
import { SettingsProvider } from "@/components/settings-context";
import { ToastProvider } from "@/components/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureReady();
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  const settings = await getSettings();

  return (
    <ToastProvider>
      <SettingsProvider value={settings}>
        <AppShell user={user} settings={settings}>
          {children}
        </AppShell>
      </SettingsProvider>
    </ToastProvider>
  );
}
