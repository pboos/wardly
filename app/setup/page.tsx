import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setupInitialWard } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hymnLanguages } from "@/lib/hymns/locales";
import { MeetingFields } from "./meeting-fields";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default async function SetupPage() {
  const wardCount = await prisma.ward.count();

  if (wardCount > 0) {
    notFound();
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Set up your ward</CardTitle>
          <CardDescription>
            Create your first ward and an admin user to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={setupInitialWard} className="w-full">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="wardName">Ward name</FieldLabel>
                <Input
                  id="wardName"
                  name="wardName"
                  type="text"
                  required
                  placeholder="St. Mary's Ward"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contentLocale">Ward language</FieldLabel>
                <Select name="contentLocale" defaultValue="en" required>
                  <SelectTrigger id="contentLocale" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {hymnLanguages.map(({ locale, label }) => (
                        <SelectItem key={locale} value={locale}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <MeetingFields
                timeZones={["UTC", ...Intl.supportedValuesOf("timeZone")]}
              />
              <Field>
                <FieldLabel htmlFor="userName">Your name</FieldLabel>
                <Input
                  id="userName"
                  name="userName"
                  type="text"
                  required
                  placeholder="Jane Doe"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="userEmail">Your email</FieldLabel>
                <Input
                  id="userEmail"
                  name="userEmail"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </Field>
              <Button type="submit" className="w-full">
                Create
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
