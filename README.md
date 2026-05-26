# Route Ink

Route Ink is a convention-driven code generator for monorepos that follow a specific style. It ships two independent tools in one package:

1. **CLI** — generates fully typed React Query hooks from your Fastify route files.
2. **Prisma generator** — generates Zod schemas and TypeScript types from your `schema.prisma`.

Both are opinionated and tuned to a particular set of conventions. Use either, both, or neither. This is a personal-style tool — no support guarantees, PRs may be ignored.

## Installation

```bash
pnpm add -D route-ink
```

This installs two binaries into `node_modules/.bin/`:

- `route-ink` — the CLI
- `route-ink-prisma-generator` — the Prisma generator (referenced from `schema.prisma`)

---

## CLI: Fastify routes → TanStack Query hooks

Given `*.route.ts` files with `schema` definitions, the CLI generates:

- Query hooks for `GET`
- Mutation hooks for `POST`, `PUT`, `PATCH`, `DELETE`
- Utility files (`injectParams`, `serializeSearchQuery`, `buildQueryKey`, `QueryError`)

Generated hooks are typed with your schema package and parse responses with Zod where response schemas exist.

### Core assumptions

The CLI is convention-driven. It expects:

- Fastify instance is named `fastify`
- Route files end with `.route.ts`
- Route definitions use `fastify.<method>(path, options, handler)` style where `options.schema` is an object literal
- `operationId` exists in each route schema
- Shared schemas are imported from a single package (configured via `schemaPackage`)
- Config file is named `routeink.json` and lives in the current working directory

If your codebase does not follow these conventions, parsing can skip endpoints.

### Configuration

Create `routeink.json` in the project where you run the command:

```json
{
  "routesDir": "../api/src/routes",
  "outputDir": "./src/generated",
  "name": "api-client",
  "schemaPackage": "@workspace/schemas"
}
```

| Field | Default | Description |
|---|---|---|
| `routesDir` | `../api/src/routes` | Where Route Ink scans for `*.route.ts` |
| `outputDir` | (required) | Destination parent directory |
| `name` | `api-client` | Output folder name inside `outputDir` |
| `schemaPackage` | `@workspace/schemas` | Package to import schema symbols from |

### Running

```bash
pnpm route-ink generate
```

Validation errors stop generation. CLI output uses colored status badges and table-formatted warnings/errors.

### Generated structure

```text
<outputDir>/<name>/
  index.ts
  queries.ts
  mutations.ts
  endpoints/
    index.ts
    ...generated endpoint hooks
  util/
    buildQueryKey.ts
    injectParams.ts
    serializeSearchQuery.ts
    QueryError.ts
    index.ts
```

### Supported endpoint shapes

**Queries (`GET`)**: basic, params only, query only, query + params.

**Mutations (`POST`, `PUT`, `PATCH`, `DELETE`)**: basic, body only, params only, body + params. Mutation responses are optional.

### Frontend usage

Wrap your tree with the generated `RouteInkProvider` and supply your own Axios instance:

```tsx
import axios from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouteInkProvider } from "./generated/api-client/util";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });
const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <RouteInkProvider axios={api}>{children}</RouteInkProvider>
    </QueryClientProvider>
  );
}
```

A `GET` endpoint with `operationId: "getUsers"` becomes `useGetUsersSuspenseQuery`:

```tsx
const { data } = useGetUsersSuspenseQuery();
useGetUserByIdSuspenseQuery({ params: { userId: "42" } });
useSearchUsersSuspenseQuery({ query: { page: 1, search: "sam" } });
```

A mutation endpoint with `operationId: "createUser"` becomes `useCreateUserMutation`:

```tsx
const createUser = useCreateUserMutation();
createUser.mutate({ body: { name: "Sam", email: "sam@example.com" } });
updateUser.mutate({ params: { userId: "42" }, body: { name: "Updated" } });
```

### Troubleshooting

- `Configuration file not found`: ensure `routeink.json` exists in the current directory.
- `Invalid configuration`: check config keys and value types.
- Missing generated endpoint: verify file naming, Fastify instance name (`fastify`), and `operationId` presence.
- Missing schema imports in output: ensure route schemas reference symbols imported from `schemaPackage`.

---

## Prisma generator: schema.prisma → Zod schemas

Generates one Zod schema file per Prisma model and enum, plus barrel re-exports. Designed for monorepos where Prisma lives in one package and the Zod schemas are consumed from another.

### Setup

```prisma
// schema.prisma
generator zod {
  provider = "route-ink-prisma-generator"
  output   = "./generated"

  modelOutputDir = "../../../schemas/src/zod/models"
  enumOutputDir  = "../../../schemas/src/zod/enums"
}
```

Then run `prisma generate`. The `output` field is required by Prisma but is only used as the anchor for resolving `modelOutputDir` and `enumOutputDir` — nothing is written to it. Your Prisma package stays clean.

### What it generates

For each **model**: a Zod object schema, a scalar-fields enum, and a derived TypeScript type. Only scalar and enum fields are emitted — object relations (`@relation`) are skipped. Foreign-key scalars (`authorId`, etc.) are still included since they are scalar fields on the model.

For each **enum**: a Zod enum schema and a derived type.

Plus a barrel `index.ts` in each output directory and — when models and enums live in different directories — a top-level barrel at their common ancestor.

Example output for `model User { ... role: Role }` and `enum Role { ... }`:

```ts
// user.model.ts
import { z } from "zod/v4";
import { RoleSchema } from "../enums/index.js";

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  role: RoleSchema,
  createdAt: z.coerce.date(),
});

export const UserScalarFieldsSchema = z.enum([
  "id",
  "email",
  "name",
  "role",
  "createdAt",
]);

export type UserType = z.output<typeof UserSchema>;
```

```ts
// role.enum.ts
import { z } from "zod/v4";

export const RoleSchema = z.enum(["ADMIN", "USER", "MODERATOR"]);

export type RoleType = z.output<typeof RoleSchema>;
```

### Config reference

All options go in the `generator` block in `schema.prisma`. All are optional unless noted.

| Option | Type | Default | Description |
|---|---|---|---|
| `output` | string | (required by Prisma) | Anchor for resolving relative `modelOutputDir` / `enumOutputDir`. Not written to. |
| `modelOutputDir` | string | `.` | Where model files go. Relative to `output`, or absolute. |
| `enumOutputDir` | string | `.` | Where enum files go. Relative to `output`, or absolute. |
| `modelFileNamingStyle` | string | `[model-kebab].model.ts` | File naming pattern for models. |
| `enumFileNamingStyle` | string | `[enum-kebab].enum.ts` | File naming pattern for enums. |
| `modelSchemaNaming` | string | `[Model]Schema` | Exported Zod schema variable name. |
| `enumSchemaNaming` | string | `[Enum]Schema` | Exported Zod enum schema variable name. |
| `modelTypeNaming` | string | `[Model]Type` | Exported TypeScript type alias name. |
| `enumTypeNaming` | string | `[Enum]Type` | Exported TypeScript type alias name. |
| `nullStrategy` | `"null"` \| `"nullish"` | `"null"` | Whether optional Prisma fields use `.nullable()` or `.nullish()`. |
| `bigIntStrategy` | `"string"` \| `"bigint"` | `"string"` | How to map `BigInt`. |
| `bytesStrategy` | `"string"` \| `"uint8array"` | `"string"` | How to map `Bytes`. |
| `importStyle` | `"esm"` \| `"cjs"` | `"esm"` | ESM appends `.js` to relative imports; CJS does not. |
| `topLevelBarrel` | boolean | `true` | When model and enum dirs differ, emit a barrel at their common ancestor. |

### Naming pattern tokens

`*FileNamingStyle`, `*SchemaNaming`, and `*TypeNaming` options support these tokens. Inputs come from the Prisma model/enum name (always PascalCase).

| Token | Casing | Example: `UserStatus` |
|---|---|---|
| `[Model]` / `[Enum]` | PascalCase | `UserStatus` |
| `[model]` / `[enum]` | camelCase | `userStatus` |
| `[MODEL]` / `[ENUM]` | UPPER_SNAKE_CASE | `USER_STATUS` |
| `[model-kebab]` / `[enum-kebab]` | kebab-case | `user-status` |

Acronyms are preserved as units (e.g. `HTTPLog` → `httpLog` / `HTTP_LOG` / `http-log`).

### Prisma scalar → Zod mapping

| Prisma | Zod | Notes |
|---|---|---|
| `String` | `z.string()` | |
| `Int` | `z.number().int()` | |
| `Float` | `z.number()` | |
| `Boolean` | `z.boolean()` | |
| `DateTime` | `z.coerce.date()` | Always coerced. |
| `Json` | `z.any()` | |
| `Decimal` | `z.string()` | |
| `BigInt` | `z.string()` or `z.bigint()` | Per `bigIntStrategy`. |
| `Bytes` | `z.string()` or `z.instanceof(Uint8Array)` | Per `bytesStrategy`. |
| `String[]` | `z.array(z.string())` | List fields wrap in `z.array(...)`. |
| `String?` | `z.string().nullable()` | Optional fields per `nullStrategy`. |
| Enum field | The configured enum schema name | e.g. `RoleSchema`. |

### Output structure

With defaults (`modelOutputDir = "."`, `enumOutputDir = "."`), files live side-by-side and share one barrel:

```text
<output>/
  index.ts          # combined: all models + enums
  user.model.ts
  role.enum.ts
```

With separate model and enum directories (typical monorepo case):

```text
packages/schemas/src/zod/
  index.ts          # top-level barrel (when topLevelBarrel = true)
  models/
    index.ts
    user.model.ts
  enums/
    index.ts
    role.enum.ts
```

Consumers can then import from any level:

```ts
import { UserSchema, RoleSchema } from "@workspace/schemas/zod";        // top-level
import { UserSchema } from "@workspace/schemas/zod/models";             // models only
import { RoleSchema } from "@workspace/schemas/zod/enums";              // enums only
```

### CI/CD

`route-ink` must be installed before `prisma generate` runs. In a typical pipeline:

```yaml
- pnpm install                                  # pulls route-ink from npm
- pnpm --filter db exec prisma generate
```

With Turborepo, declare the install dependency so `prisma generate` runs after all installs:

```jsonc
// turbo.json
{
  "tasks": {
    "db#prisma:generate": { "dependsOn": ["^install"] }
  }
}
```

No special handling is required for multi-file Prisma schemas (`prismaSchemaFolder`) — Prisma merges them into one DMMF before the generator sees it.

---

## Development

```bash
pnpm install
pnpm build              # builds dist/
pnpm dev                # watch mode
pnpm test               # vitest
```

To test against a real consuming project without publishing:

```bash
pnpm link --global      # from this repo
```

The `route-ink-prisma-generator` bin is then available globally. Unlink when done:

```bash
pnpm unlink --global route-ink
```

## Commands

```bash
route-ink generate      # generate Fastify → TanStack hooks
route-ink --help

prisma generate         # runs the Prisma generator when configured in schema.prisma
```
