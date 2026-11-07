import { redirect } from "next/navigation";
import { ensureReady, DEMO_CREDENTIALS } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureReady();
  const user = await getSessionUser();
  if (user) redirect("/tableau-de-bord");
  return <LoginForm demo={DEMO_CREDENTIALS} />;
}
