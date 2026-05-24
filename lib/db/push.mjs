import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Check your .env file.");
  process.exit(1);
}

// 1. Compile schema TypeScript → CJS so drizzle-kit can load it without issues
console.log("Compiling schema...");
mkdirSync(path.join(__dirname, "dist-schema"), { recursive: true });
await build({
  entryPoints: [path.join(__dirname, "src/schema/index.ts")],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: path.join(__dirname, "dist-schema/index.js"),
  external: ["drizzle-orm", "drizzle-zod", "pg", "zod"],
  logLevel: "silent",
});

// 2. Write a temporary CJS drizzle config pointing to the compiled schema
const tmpConfig = path.join(__dirname, "drizzle.config.built.cjs");
writeFileSync(
  tmpConfig,
  `module.exports = {
  schema: "./dist-schema/index.js",
  dialect: "postgresql",
  dbCredentials: { url: ${JSON.stringify(process.env.DATABASE_URL)} },
};`
);

// 3. Run drizzle-kit push using the compiled config
console.log("Pushing schema to database...");
const dkPath = path.join(__dirname, "node_modules/drizzle-kit/bin.cjs");
try {
  execFileSync(process.execPath, [dkPath, "push", "--config", tmpConfig], {
    stdio: "inherit",
    cwd: __dirname,
  });
} finally {
  try { unlinkSync(tmpConfig); } catch {}
}
