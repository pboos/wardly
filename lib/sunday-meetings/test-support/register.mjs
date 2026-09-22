import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Match the app's @/* alias and extensionless TypeScript imports in Node tests.
const root = new URL("../../../", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export {}" };
    }
    let target = specifier.startsWith("@/")
      ? new URL(specifier.slice(2), root).href
      : specifier;
    if (target.startsWith(".") || target.startsWith("file:")) {
      const url = new URL(target, context.parentURL);
      if (
        !existsSync(fileURLToPath(url)) &&
        existsSync(fileURLToPath(url) + ".ts")
      )
        target = url.href + ".ts";
    }
    return nextResolve(target, context);
  },
});
