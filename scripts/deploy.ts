const build = Bun.spawnSync(["bun", "run", "build"], {
  stdin: "inherit",
  stdout: "inherit",
  stderr: "inherit",
});

if (build.exitCode !== 0) {
  console.error("Refusing to deploy: bun run build failed.");
  process.exit(build.exitCode ?? 1);
}

const deploy = Bun.spawnSync(
  ["bunx", "wrangler", "deploy", ...process.argv.slice(2)],
  {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  },
);

process.exit(deploy.exitCode ?? 1);
