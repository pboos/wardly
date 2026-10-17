import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
registerHooks({
  load(url, context, next) {
    if (!url.endsWith("/markdown-instructions.tsx")) return next(url, context);
    const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    return { format: "module", source, shortCircuit: true };
  },
});
const { MarkdownInstructions } =
  await import("../../app/meetings/leadership/markdown-instructions.tsx");
test("Markdown instructions render structure and safe links without raw HTML or script URLs", () => {
  const output = renderToStaticMarkup(
    React.createElement(
      MarkdownInstructions,
      null,
      '## Prepare\n\n- **Bold** and *emphasis*\n\n[Handbook](https://www.churchofjesuschrist.org/)\n\n[Unsafe](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n<img src="bad" onerror="alert(1)">',
    ),
  );
  assert.match(output, /<h2>Prepare<\/h2>/);
  assert.match(output, /<ul>/);
  assert.match(output, /<strong>Bold<\/strong>/);
  assert.match(output, /<em>emphasis<\/em>/);
  assert.match(output, /href="https:\/\/www.churchofjesuschrist.org\/"/);
  assert.doesNotMatch(output, /javascript:|<script|<img|onerror=/);
});
