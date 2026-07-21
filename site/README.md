# Spellbook Project Site

This isolated workspace contains the official product site for `Spellbook 魔法书`,
the local-first desktop AI prompt and Agent Skill manager. The application and its
website intentionally keep separate dependencies, build output, and deployment
configuration.

## Architecture

- `app/` contains the page, metadata, and responsive visual system.
- `public/` contains the application icon and social preview artwork.
- `worker/` and `.openai/` preserve the existing Sites deployment path.
- `scripts/build-pages.mjs` converts the validated server render into a static,
  project-path-safe GitHub Pages artifact.
- `tests/` protects product copy, metadata, and both deployment outputs.

## Commands

```bash
npm install
npm run dev
npm run build
npm run build:pages
npm test
```

`npm run build` produces the Sites worker. `npm run build:pages` also writes the
static GitHub Pages entry point to `dist/client/`.

## GitHub Pages

The root workflow `.github/workflows/deploy-site.yml` publishes `dist/client/`
after every website change on `main`. For the first deployment, set the repository
Pages source to **GitHub Actions** under **Settings → Pages**.
