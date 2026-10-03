import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";

export const auth = betterAuth({
  database: { db, type: "postgres" },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account", // always show the account picker
    },
  },
  // No emailAndPassword block: Google is the only way in
  plugins: [nextCookies()], // keep last; lets server actions set cookies
});
