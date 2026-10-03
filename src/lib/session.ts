import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";

// Looks up the session once per request, however many times it's called
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

// For pages, layouts, and the DAL: redirects if logged out
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session; // never null here, TypeScript knows redirect() doesn't return
}
