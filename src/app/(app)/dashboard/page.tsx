import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/welcome");

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Hi, {session.user.name}</h1>
      <p>{session.user.email}</p>
      <SignOutButton />
    </main>
  );
}
