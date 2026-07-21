import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repository = process.env.GITHUB_REPOSITORY ?? "YangMingSJTU/Prompt_Is_All_You_Need";
const [owner, repositoryName] = repository.split("/");

if (!owner || !repositoryName) {
  throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);
}

const isUserSite = repositoryName.toLowerCase() === `${owner}.github.io`.toLowerCase();
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? (isUserSite ? "" : `/${repositoryName}`);
const origin = process.env.GITHUB_PAGES_ORIGIN ?? `https://${owner.toLowerCase()}.github.io`;
const workerUrl = pathToFileURL(path.join(projectRoot, "dist/server/index.js"));
workerUrl.searchParams.set("pages", `${process.pid}-${Date.now()}`);

const { default: worker } = await import(workerUrl.href);
const response = await worker.fetch(
  new Request(`${origin}/`, {
    headers: {
      accept: "text/html",
      host: new URL(origin).host,
      "x-forwarded-host": new URL(origin).host,
      "x-forwarded-proto": "https",
    },
  }),
  {
    ASSETS: {
      fetch: async () => new Response("Not found", { status: 404 }),
    },
  },
  {
    waitUntil() {},
    passThroughOnException() {},
  },
);

if (!response.ok) {
  throw new Error(`Unable to render the homepage: HTTP ${response.status}`);
}

let html = await response.text();
const assetRoots = ["/assets/", "/app-icon.png", "/og.png", "/favicon.svg"];

for (const assetRoot of assetRoots) {
  html = html.replaceAll(assetRoot, `${basePath}${assetRoot}`);
}

const canonicalUrl = `${origin}${basePath}/`;
html = html.replace("</head>", `<link rel="canonical" href="${canonicalUrl}"/></head>`);

const outputDirectory = path.join(projectRoot, "dist/client");
await Promise.all([
  writeFile(path.join(outputDirectory, "index.html"), html, "utf8"),
  writeFile(path.join(outputDirectory, "404.html"), html, "utf8"),
  writeFile(path.join(outputDirectory, ".nojekyll"), "", "utf8"),
]);

const renderedHtml = await readFile(path.join(outputDirectory, "index.html"), "utf8");
if (!renderedHtml.includes(`${basePath}/assets/`) || !renderedHtml.includes(canonicalUrl)) {
  throw new Error("GitHub Pages output is missing its project base path or canonical URL.");
}

console.log(`GitHub Pages output prepared at ${canonicalUrl}`);
