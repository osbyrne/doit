const root = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
  stdout: "pipe",
  stderr: "pipe",
});

if (root.exitCode !== 0) {
  console.log("Skipping Git hook setup: this directory is not inside a Git repository.");
  process.exit(0);
}

const repoRoot = root.stdout.toString().trim();
const configured = Bun.spawnSync(["git", "config", "--local", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdout: "inherit",
  stderr: "inherit",
});

if (configured.exitCode !== 0) {
  console.error("Could not configure Git to use the repository hooks in .githooks.");
  process.exit(configured.exitCode ?? 1);
}

console.log("Git hooks installed from .githooks.");
