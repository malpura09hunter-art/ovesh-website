const fs = require("node:fs");
const path = require("node:path");
const esbuild = require("esbuild");

const root = process.cwd();
const apiRoot = path.join(root, "api");
const outRoot = path.join(root, ".render-build", "api");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith(".js") ? [full] : [];
  });
}

async function main() {
  const files = walk(apiRoot);
  if (!files.length) {
    throw new Error("No JavaScript API handlers were found under ./api");
  }

  fs.rmSync(path.join(root, ".render-build"), { recursive: true, force: true });

  for (const file of files) {
    const relative = path.relative(apiRoot, file);
    const output = path.join(outRoot, relative.replace(/\.js$/, ".cjs"));
    fs.mkdirSync(path.dirname(output), { recursive: true });

    await esbuild.build({
      entryPoints: [file],
      outfile: output,
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node20",
      packages: "external",
      define: {
        __dirname: JSON.stringify(path.dirname(file)),
        __filename: JSON.stringify(file)
      },
      logLevel: "silent"
    });
  }

  console.log(`Prepared ${files.length} API handlers for Render.`);
}

main().catch((error) => {
  console.error("Render API build failed:", error);
  process.exit(1);
});
