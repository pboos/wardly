# Design and UI guidelines

Wardly uses **shadcn** (radix-vega style) on top of **Tailwind CSS v4** with OKLCH design tokens. All UI must be built with shadcn components — do not write raw `<input>`, `<button>`, or ad-hoc card markup.

Use shadcn skill when working on html/ui/design.

## Colors (OKLCH tokens, defined in `app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` / `--foreground` | white / near-black | near-black / white | Page surfaces |
| `--primary` | blue `oklch(0.5 0.134 242.749)` | blue `oklch(0.443 0.11 240.79)` | Primary actions, links |
| `--secondary` / `--muted` / `--accent` | warm mauve neutrals | dark neutrals | Secondary surfaces, hover, muted text |
| `--destructive` | red `oklch(0.577 0.245 27.325)` | red `oklch(0.704 0.191 22.216)` | Errors, destructive actions |
| `--border` / `--input` / `--ring` | mauve neutrals | translucent white | Borders, focus rings |
| `--card` / `--popover` / `--sidebar` | white | dark card | Elevated surfaces |

Always reference tokens via Tailwind utilities (`bg-background`, `text-primary`, `border-border`, `text-muted-foreground`, etc.) — never hardcode hex/oklch values in components. Dark mode is handled via the `.dark` class.

### Looking up usage & props

Use **Context7** (library ID `/shadcn-ui/ui`) to fetch current docs and code examples for any shadcn component — APIs evolve, so check before writing code.

## Best practices

- Use the `cn` helper (`@/lib/utils`) to merge classes — never string-concatenate conditional classes.
- Keep components accessible: every input needs a label (`htmlFor` ↔ `id`); use `aria-invalid` and `role="alert"` (Field provides this) for errors.
- Prefer semantic color utilities (`text-muted-foreground`, `bg-destructive/10`) over custom palette classes.
- Keep radius/spacing consistent via the token-driven `--radius` scale and shadcn sizes (`sm`, `default`, `lg`).
