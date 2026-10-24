import { resolveHymnLocale } from "../hymns/locales.ts";
import en from "./leading-copy/en.json" with { type: "json" };
import de from "./leading-copy/de.json" with { type: "json" };

export type ScriptCopy = typeof en;
export type ScriptCopyKey = keyof ScriptCopy;
export type ScriptSpan =
  | { kind: "text"; text: string }
  | { kind: "name"; text: string }
  | { kind: "missing"; text: string };
export type ScriptParagraph =
  | { kind: "spoken"; spans: readonly ScriptSpan[] }
  | { kind: "heading"; spans: readonly ScriptSpan[] }
  | { kind: "list"; rows: readonly (readonly ScriptSpan[])[] }
  | { kind: "rule" };

const german: ScriptCopy = de;
export function leadingCopy(locale: string) {
  const language = resolveHymnLocale(locale);
  return { copy: language === "de" ? german : en, locale: language === "de" ? "de" : "en", fallback: language !== "de" && language !== "en" };
}

export function expandCopy(template: string, values: Readonly<Record<string, readonly ScriptSpan[]>> = {}): ScriptSpan[] {
  return template.split(/(\{\w+\})/).flatMap((part): ScriptSpan[] => {
    if (!part.startsWith("{")) return part ? [{ kind: "text", text: part }] : [];
    const key = part.slice(1, -1);
    const value = values[key];
    if (!value) throw new Error(`Missing leading script placeholder: ${key}`);
    return [...value];
  });
}
