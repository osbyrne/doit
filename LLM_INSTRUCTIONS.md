# Instructions for LLMs

This repository uses Bun. Follow the Solid and TSRX guidance in `AGENTS.md` when editing application code.

## Project workflow

- Use Bun for dependency installation and package scripts. Do not introduce npm or pnpm commands into project instructions.
- Run `bun run hooks:install` once per checkout to configure the repository's pre-commit hook. Bun's `prepare` lifecycle also installs it after dependency installation.
- The pre-commit hook runs `bun run check`. This checks formatting, lint, type errors, tests, and the production build. Resolve failures before committing. If files change after validation, run the check again before committing.
- To apply formatting, run:

  ```sh
  bun run format
  ```

- Git hooks are local guardrails and can be bypassed with `git commit --no-verify`; do not bypass them.
- Deploy only when explicitly requested. The deploy command builds the static client and publishes the Worker.

## Cloudflare Workers deployment

The client build is written to `dist/client`; `wrangler.jsonc` configures the
`doit` Worker to serve it and route `/api/todos` to the Worker handler.

Deploy directly to Cloudflare Workers with:

```sh
bun run deploy
```

Wrangler must already be authenticated to the intended Cloudflare account.

The todo API runs in the Worker. Set `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` as Worker secrets with `wrangler secret put`; keep the token
server-side.
