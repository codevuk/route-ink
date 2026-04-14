# Route Ink

Route Ink is a CLI that generates typed React Query hooks from Fastify route files.

It is optimized for monorepos where your API routes and shared Zod schemas follow consistent conventions.

## What It Generates

Given `*.route.ts` files with `schema` definitions, Route Ink generates:

- Query hooks for `GET`
- Mutation hooks for `POST`, `PUT`, `PATCH`, `DELETE`
- Utility files (`injectParams`, `serializeSearchQuery`, `buildQueryKey`, `QueryError`)

Generated hooks are typed with your schema package and parse responses with Zod where response schemas exist.

## Core Assumptions (Important)

Route Ink is convention-driven. It expects:

- Fastify instance is named `fastify`
- Route files end with `.route.ts`
- Route definitions use `fastify.<method>(path, options, handler)` style where `options.schema` is an object literal
- `operationId` exists in each route schema
- Shared schemas are imported from a single package (configured via `schemaPackage`)
- Config file is named `routeink.json` and lives in the current working directory

If your codebase does not follow these conventions, parsing can skip endpoints.

## Installation

### As a package dependency

```bash
pnpm add -D route-ink
```

### Local project usage

```bash
pnpm route-ink generate
```

Or if you have it linked globally:

```bash
route-ink generate
```

## Configuration

Create `routeink.json` in the project where you run the command.

Example:

```json
{
	"routesDir": "../api/src/routes",
	"outputDir": "./src/generated",
	"name": "api-client",
	"schemaPackage": "@workspace/schemas"
}
```

Config fields:

- `routesDir` (string, default: `../api/src/routes`): where Route Ink scans for `*.route.ts`
- `outputDir` (string, required): destination parent directory
- `name` (string, default: `api-client`): output folder name inside `outputDir`
- `schemaPackage` (string, default: `@workspace/schemas`): package to import schema symbols from

## Generated Structure

Output root:

```text
<outputDir>/<name>/
	index.ts
	queries.ts
	mutations.ts
	endpoints/
		index.ts
		...generated endpoint hooks
		...nested route folders with index.ts barrels
	util/
		buildQueryKey.ts
		injectParams.ts
		serializeSearchQuery.ts
		QueryError.ts
		index.ts
```

## Supported Endpoint Shapes

### Queries (`GET`)

- Basic
- Params only
- Query only
- Query + params

### Mutations (`POST`, `PUT`, `PATCH`, `DELETE`)

- Basic
- Body only
- Params only
- Body + params

Notes:

- Mutation responses are optional.

## Validation and CLI Output

The generator validates route metadata and prints:

- Colored status badges (`START`, `OK`, `FAILED`, `SUCCESS`)
- Table-style warnings
- Table-style validation errors
- End summary (routes/warnings/errors)

Validation errors stop generation.

## Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build once

```bash
pnpm build
```

### 3. Run in watch/dev mode

```bash
pnpm dev
```

This watches source files and rebuilds `dist`.

### 4. Link `route-ink` globally with pnpm

From this repository root:

```bash
pnpm link --global
```

Now you can run:

```bash
route-ink generate
```

From any project folder that contains a valid `routeink.json`.

### 5. Unlink when done

```bash
pnpm unlink --global route-ink
```

If needed, re-link again with `pnpm link --global`.

## Typical Monorepo Workflow

1. Define/update Fastify route schemas in API package.
2. Ensure shared schema symbols come from your configured `schemaPackage`.
3. Run `route-ink generate` from the consumer package (or workspace) that has `routeink.json`.
4. Import generated hooks from `<outputDir>/<name>`, `<outputDir>/<name>/queries`, or `<outputDir>/<name>/mutations`.

Recommended import surface:

- Use the top-level barrels for app code.
- Treat individual generated endpoint files as implementation details that may move when routes change.

## Frontend Usage

In a frontend app, wrap the part of your React tree that uses generated hooks with the generated `RouteInkProvider`.

Route Ink expects you to provide your own Axios instance. That is where you should set `baseURL`, headers, interceptors, and auth behavior for your application.

Example with auth:

```ts
import axios from "axios";

export const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
	const token = localStorage.getItem("token");

	if (token) {
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});
```

Provider setup:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouteInkProvider } from "./generated/api-client/util";
import { api } from "./lib/api";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			<RouteInkProvider axios={api}>{children}</RouteInkProvider>
		</QueryClientProvider>
	);
}
```

### Query Example

Generated query hooks use React Query suspense APIs. A `GET` endpoint with `operationId: "getUsers"` becomes `useGetUsersSuspenseQuery`.

```tsx
import { useGetUsersSuspenseQuery } from "./generated/api-client/queries";

export function UsersList() {
	const { data } = useGetUsersSuspenseQuery();

	return (
		<ul>
			{data.map((user) => (
				<li key={user.id}>{user.name}</li>
			))}
		</ul>
	);
}
```

If the route has params or querystring input, pass them as the first argument:

```tsx
useGetUserByIdSuspenseQuery({
	params: { userId: "42" },
});

useSearchUsersSuspenseQuery({
	query: { page: 1, search: "sam" },
});
```

### Mutation Example

A mutation endpoint with `operationId: "createUser"` becomes `useCreateUserMutation`.

```tsx
import { useCreateUserMutation } from "./generated/api-client/mutations";

export function CreateUserButton() {
	const createUser = useCreateUserMutation();

	return (
		<button
			onClick={() => {
				createUser.mutate({
					body: {
						name: "Sam",
						email: "sam@example.com",
					},
				});
			}}
		>
			Create user
		</button>
	);
}
```

If the mutation route also has params, include both `params` and `body`:

```tsx
updateUser.mutate({
	params: { userId: "42" },
	body: { name: "Updated name" },
});
```

## Troubleshooting

- `Configuration file not found`: ensure `routeink.json` exists in current directory.
- `Invalid configuration`: check config keys and value types.
- Missing generated endpoint: verify file naming, Fastify instance name (`fastify`), and `operationId` presence.
- Missing schema imports in output: ensure route schemas reference symbols imported from `schemaPackage`.

## Commands

```bash
route-ink generate
```

```bash
route-ink --help
```

