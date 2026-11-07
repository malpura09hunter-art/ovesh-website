const fs = require("node:fs");
const path = require("node:path");
const express = require("express");

const app = express();
const root = process.cwd();
const apiRoot = path.join(root, ".render-build", "api");
const vercelConfigPath = path.join(root, "vercel.json");
const vercelConfig = fs.existsSync(vercelConfigPath)
  ? JSON.parse(fs.readFileSync(vercelConfigPath, "utf8"))
  : {};
const rewrites = Array.isArray(vercelConfig.rewrites) ? vercelConfig.rewrites : [];

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

app.use((req, res, next) => {
  const p = req.path || "/";
  if (
    p.startsWith("/api/") ||
    p.startsWith("/oveshcloud") ||
    p.startsWith("/ovesh/") ||
    p.startsWith("/vitaminserum") ||
    p === "/compiler.html"
  ) {
    res.setHeader("Cache-Control", "no-store");
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.use(express.raw({
  type: ["application/octet-stream", "application/pdf"],
  limit: "25mb"
}));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

function sourceToRegex(source) {
  const marker = "__VERCEL_WILDCARD__";
  const escaped = source
    .replace(/\(\.\*\)/g, marker)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll(marker, "(.*)");
  return new RegExp("^" + escaped + "$");
}

app.use((req, _res, next) => {
  const current = new URL(req.url, "http://render.local");
  for (const rule of rewrites) {
    if (!rule || typeof rule.source !== "string" || typeof rule.destination !== "string") continue;
    const match = current.pathname.match(sourceToRegex(rule.source));
    if (!match) continue;

    const [destinationPath, destinationQuery = ""] = rule.destination.split("?", 2);
    const rewrittenPath = destinationPath.replace(/\$(\d+)/g, (_whole, n) => match[Number(n)] || "");
    const params = new URLSearchParams(destinationQuery);
    for (const [key, value] of current.searchParams.entries()) {
      if (!params.has(key)) params.append(key, value);
    }
    req.url = rewrittenPath + (params.toString() ? "?" + params.toString() : "");
    break;
  }
  next();
});

function resolveHandler(requestPath) {
  let route = requestPath.replace(/^\/api\/?/, "").replace(/\.js$/, "");
  if (!route || route.includes("\0")) return null;
  const candidates = [
    path.resolve(apiRoot, route + ".cjs"),
    path.resolve(apiRoot, route, "index.cjs")
  ];
  return candidates.find((candidate) =>
    candidate.startsWith(apiRoot + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  ) || null;
}

app.use("/api", (req, res, next) => {
  const handlerPath = resolveHandler(req.path);
  if (!handlerPath) return res.status(404).json({ error: "API route not found" });

  try {
    const loaded = require(handlerPath);
    const handler = typeof loaded === "function" ? loaded : loaded && loaded.default;
    if (typeof handler !== "function") {
      return res.status(500).json({ error: "API handler export is not a function" });
    }
    Promise.resolve(handler(req, res)).catch((error) => {
      console.error("API handler failed:", req.path, error);
      if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
      else res.end();
    });
  } catch (error) {
    console.error("Unable to load API handler:", req.path, error);
    if (!res.headersSent) res.status(500).json({ error: "Unable to load API handler" });
    else res.end();
  }
});

app.use((req, res, next) => {
  const pathname = decodeURIComponent(req.path || "/");
  const blocked = [
    "/node_modules", "/scripts", "/.render-build", "/api",
    "/package.json", "/package-lock.json", "/render-server.js",
    "/vercel.json", "/render.yaml"
  ];
  if (blocked.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) {
    return res.status(404).send("Not Found");
  }
  next();
});

app.use(express.static(root, {
  dotfiles: "deny",
  index: "index.html",
  fallthrough: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
  }
}));

app.use((req, res) => res.status(404).send("Not Found"));

const port = Number(process.env.PORT || 10000);
app.listen(port, "0.0.0.0", () => {
  console.log(`OVESH website listening on port ${port}`);
});
