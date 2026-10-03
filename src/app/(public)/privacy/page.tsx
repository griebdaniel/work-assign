import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy Policy – Work Assign",
};

const CONTACT_EMAIL = "griebdaniel94@gmail.com";
const LAST_UPDATED = "October 3, 2026";

export default function PrivacyPage() {
  return (
    <main className="flex min-h-screen justify-center bg-muted/40 p-4 sm:py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          <CardDescription>Last updated: {LAST_UPDATED}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-sm leading-relaxed">
          <p>
            Work Assign (&quot;we&quot;, &quot;the app&quot;) helps you plan
            supplies, production and work schedules. This page explains what
            data the app collects and how it is used.
          </p>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">What we collect</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>From your Google account</strong>, when you sign in:
                your name, email address and profile picture. We do not get
                access to your Gmail, Drive, contacts or any other Google data.
              </li>
              <li>
                <strong>Data you enter</strong> into the app, such as supplies,
                products, orders, employees, skills, shifts and schedules.
              </li>
              <li>
                <strong>Session data</strong> needed to keep you signed in: a
                session cookie, plus the IP address and browser information
                attached to your session.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">How we use it</h2>
            <p>
              Only to sign you in and to provide the app&apos;s features. Your
              data is visible only to your account. We do not sell it, share it
              with advertisers, or use it for tracking or analytics.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Where it is stored</h2>
            <p>
              The app is hosted on Vercel and the data is stored in a Postgres
              database hosted by Neon. Both act only as infrastructure providers
              and process the data on our behalf.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Cookies</h2>
            <p>
              We use only the cookies required for signing in. There are no
              advertising or third-party tracking cookies.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">
              Keeping and deleting your data
            </h2>
            <p>
              Your data is kept while your account exists. To delete your
              account and all of its data, email{" "}
              <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>{" "}
              and we will remove it. You can also revoke the app&apos;s access
              at any time from your Google account&apos;s security settings.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Changes</h2>
            <p>
              If this policy changes, we will update this page and the date
              above.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold">Contact</h2>
            <p>
              Questions? Email{" "}
              <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <Link href="/welcome" className="inline-block underline">
            ← Back to Work Assign
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
