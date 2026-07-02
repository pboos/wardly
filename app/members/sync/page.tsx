import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/dal";
import { SyncForm } from "./sync-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function MembersSyncPage() {
  await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sync members from LCR</CardTitle>
          <CardDescription>
            Import your ward&apos;s member list from Leader and Clerk Resources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-medium text-foreground">1.</span>
                <span>
                  Open the{" "}
                  <Link
                    href="https://lcr.churchofjesuschrist.org/mlt/records/member-list?lang=eng"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    LCR member list
                  </Link>{" "}
                  (opens in a new tab).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">2.</span>
                <span>
                  Open Developer Tools &rarr; Console (More Tools &rarr;
                  Developer Tools &rarr; Console).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">3.</span>
                <span>
                  Type <code className="font-mono text-xs">allow pasting</code>{" "}
                  and press Enter (Chrome requires this before pasting into the
                  console).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">4.</span>
                <span>
                  Click <strong className="text-foreground">Copy script</strong>{" "}
                  below to copy the JavaScript snippet to your clipboard.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">5.</span>
                <span>
                  Paste the script into the console and press Enter. The console
                  prints an array of objects.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">6.</span>
                <span>
                  Right-click the array and select{" "}
                  <strong className="text-foreground">Copy object</strong>.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">7.</span>
                <span>Paste the copied JSON into the textarea below.</span>
              </li>
            </ol>

            <p className="text-xs text-muted-foreground">
              Note: The script only works on the English LCR site (
              <code className="font-mono">?lang=eng</code>).
            </p>

            <SyncForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
