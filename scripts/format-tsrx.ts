const mode = process.argv[2];

if (mode !== "--write" && mode !== "--check") {
  console.error("Usage: bun scripts/format-tsrx.ts --write|--check");
  process.exit(2);
}

const files = Array.from(new Bun.Glob("src/**/*.tsrx").scanSync({ cwd: process.cwd() })).sort();

if (files.length === 0) {
  process.exit(0);
}

const result = Bun.spawnSync(["bun", "run", "--bun", "oxc-tsrx-fmt", mode, ...files], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

process.exit(result.exitCode ?? 1);
