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
                  (opens in a new tab). Clear search and filters, and wait until
                  the full member list has loaded.
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
                  If Chrome blocks pasting, review the script and follow the
                  console’s instructions to enable pasting.
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
                  Paste the script into the console and press Enter. It reads
                  the loaded member list and copies the export to your
                  clipboard.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">6.</span>
                <span>
                  Check that “Wardly: exported … members” matches the full
                  directory count and that the console says “Copied!”.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-foreground">7.</span>
                <span>Paste the copied JSON into the textarea below.</span>
              </li>
            </ol>

            <p className="text-xs text-muted-foreground">
              Use the English LCR site (
              <code className="font-mono">?lang=eng</code>).
            </p>

            <p className="text-sm text-muted-foreground">
              If automatic copying is unavailable, run{" "}
              <code className="font-mono text-xs">copy(wardlyLcr.json)</code> in
              the console. If the count is wrong, clear filters, reload the
              directory, wait for it to load, and paste the script again. When
              LCR does not provide email addresses, existing Wardly emails are
              preserved.
            </p>

            <SyncForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
