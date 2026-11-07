import { redirect } from "next/navigation";
import { ensureReady } from "@/lib/bootstrap";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  await ensureReady();
  const user = await getSessionUser();
  redirect(user ? "/tableau-de-bord" : "/connexion");
}
