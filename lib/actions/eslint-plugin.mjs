import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

function isActionModule(specifier, filename) {
  const base = specifier.startsWith("@/")
    ? resolve(process.cwd(), specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(filename), specifier)
      : null;
  if (!base) return false;
  const file = [base, `${base}.ts`, `${base}.tsx`].find(
    (path) => existsSync(path) && /\.[cm]?[jt]sx?$/.test(path),
  );
  if (file) return /^\s*["']use server["'];?/.test(readFileSync(file, "utf8"));
  // Also validate conventionally named actions before a new module exists.
  return /(?:^|\/)(?:bulk-tag-)?actions(?:\.ts)?$/.test(specifier);
}

/** Protected action imports may only enter client code through useAppMutation.
 * Checking binding references also catches aliases and passing raw actions as props.
 */
export const protectedActionRule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      wrap: "Pass protected actions to useAppMutation; invoke its execute function instead.",
      named:
        "Use named protected action imports so useAppMutation usage can be checked.",
    },
  },
  create(context) {
    const source = context.sourceCode;
    const protectedImports = [];
    const hookBindings = new Set();
    return {
      ImportDeclaration(node) {
        if (node.source.value === "@/lib/actions/use-app-mutation") {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === "ImportSpecifier" &&
              specifier.imported.name === "useAppMutation"
            ) {
              for (const binding of source.getDeclaredVariables(specifier))
                hookBindings.add(binding);
            }
          }
        }
        if (
          node.importKind === "type" ||
          !isActionModule(node.source.value, context.filename)
        )
          return;
        for (const specifier of node.specifiers) {
          if (specifier.importKind === "type") continue;
          if (specifier.type !== "ImportSpecifier") {
            context.report({ node: specifier, messageId: "named" });
          } else protectedImports.push(specifier);
        }
      },
      "Program:exit"() {
        const hookReferences = new Set(
          [...hookBindings].flatMap((binding) =>
            binding.references.map((ref) => ref.identifier),
          ),
        );
        for (const specifier of protectedImports) {
          for (const variable of source.getDeclaredVariables(specifier)) {
            for (const reference of variable.references) {
              if (reference.isValueReference === false) continue;
              const identifier = reference.identifier;
              const call = identifier.parent;
              if (
                call.type === "CallExpression" &&
                call.arguments[0] === identifier &&
                hookReferences.has(call.callee)
              )
                continue;
              context.report({ node: identifier, messageId: "wrap" });
            }
          }
        }
      },
    };
  },
};

const plugin = { rules: { "protected-action": protectedActionRule } };
export default plugin;
