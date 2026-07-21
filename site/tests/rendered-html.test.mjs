import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
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
}

test("server-renders the Spellbook project introduction", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Spellbook 魔法书｜让每一次好提示，沉淀成你的能力<\/title>/i);
  assert.match(html, /让每一次好提示/);
  assert.match(html, /沉淀成你的能力/);
  assert.match(html, /咒语库/);
  assert.match(html, /技能库/);
  assert.match(html, /Local-first by default/);
  assert.match(html, /从一次好对话，到随手可用的能力/);
  assert.match(html, /~\/\.spellbook\/index\.sqlite/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("prepares a project-path-safe GitHub Pages artifact", async () => {
  const html = await readFile(new URL("dist/client/index.html", templateRoot), "utf8");

  assert.match(html, /href="\/Prompt_Is_All_You_Need\/assets\//);
  assert.match(html, /src="\/Prompt_Is_All_You_Need\/app-icon\.png"/);
  assert.match(
    html,
    /rel="canonical" href="https:\/\/yangmingsjtu\.github\.io\/Prompt_Is_All_You_Need\/"/,
  );
  assert.doesNotMatch(html, /(?:src|href)="\/(?:assets\/|app-icon\.png|og\.png)/);

  await access(new URL("dist/client/.nojekyll", templateRoot));
  await access(new URL("dist/client/404.html", templateRoot));
});

test("keeps starter preview artifacts out of the finished site", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/i);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|_sites-preview/i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/i);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await assert.rejects(
    access(new URL("public/_sites-preview", templateRoot)),
  );
  await assert.rejects(access(new URL("app/chatgpt-auth.ts", templateRoot)));
  await assert.rejects(access(new URL("examples/d1/app/api/notes/route.ts", templateRoot)));
  await assert.rejects(access(new URL("db/index.ts", templateRoot)));
  assert.doesNotMatch(packageJson, /drizzle|db:generate/i);
});
