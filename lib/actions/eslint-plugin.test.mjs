import { RuleTester } from "eslint";
import { protectedActionRule } from "./eslint-plugin.mjs";

const imports = `import { save as saveAction } from "./actions";
import { useAppMutation as useMutation } from "@/lib/actions/use-app-mutation";`;

new RuleTester().run("protected-action", protectedActionRule, {
  valid: [
    `${imports} function Component() { const {execute} = useMutation(saveAction); execute("draft"); }`,
    'import { format } from "./utils"; format();',
  ],
  invalid: [
    {
      code: `${imports} saveAction(null, "draft");`,
      errors: [{ messageId: "wrap" }],
    },
    {
      code: `${imports} const bypass = saveAction;`,
      errors: [{ messageId: "wrap" }],
    },
    {
      code: `${imports} consume(saveAction);`,
      errors: [{ messageId: "wrap" }],
    },
    {
      code: `${imports} function f(useMutation) { useMutation(saveAction); }`,
      errors: [{ messageId: "wrap" }],
    },
    {
      code: 'import * as actions from "./actions";',
      errors: [{ messageId: "named" }],
    },
  ],
});
