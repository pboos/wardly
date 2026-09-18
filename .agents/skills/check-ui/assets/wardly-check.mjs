import assert from "node:assert/strict";
import { join } from "node:path";

// Copy to /tmp and adapt selectors and assertions to the feature being changed.
// This baseline uses the existing Wardly demo. It creates no product records.
export default async function ({ page, expect, outputDir }) {
  await page.goto("/members");
  if (new URL(page.url()).pathname === "/login") {
    await expect(page.getByText(/Local development: use code 123456\. No email is sent\./)).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.getByLabel("Code", { exact: true }).fill("123456");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await page.waitForURL(url => url.pathname !== "/login");
    await page.goto("/members");
  }
  await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "Manage tags", exact: true })).toBeVisible();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `Page overflows at ${width}px`);
    const list = width >= 640 ? page.locator("table") : page.locator("ul.sm\\:hidden");
    const edit = list.getByRole("button", { name: /^Edit tags for / }).first();
    await expect(edit).toBeVisible();
    await edit.click();
    const picker = page.getByRole("dialog");
    await expect(picker.getByLabel("Search tags", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await page.screenshot({ path: join(outputDir, `members-${width}.png`), animations: "disabled" });
  }
  // Test actual rendered badges; portal/picker checks belong in feature scenarios too.
  const originallyDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
  try {
    for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), dark);
      const badge = page.locator("[data-variant=memberTag]:visible").first();
      if (await badge.count()) {
        // Poll through CSS transitions instead of sleeping for a fixed duration.
        await expect.poll(() => badge.evaluate(el => getComputedStyle(el).backgroundColor))
          .not.toBe("rgba(0, 0, 0, 0)");
        const colors = await badge.evaluate(el => {
          const css = getComputedStyle(el);
          return { background: css.backgroundColor, foreground: css.color };
        });
        assert.notEqual(colors.background, colors.foreground);
      }
      await page.screenshot({ path: join(outputDir, `members-${dark ? "dark" : "light"}.png`), animations: "disabled" });
    }
  } finally {
    await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), originallyDark);
  }
}
