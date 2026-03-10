# Helix Importer UI – Setup Guide

This codebase is the **AEM Importer UI**: it imports content from a live site (e.g. hero sections, pages) and transforms it into the structure required for **AEM Edge Delivery Services (EDS)** and **Universal Editor (UE)** — i.e. Markdown → Word (docx) that AEM can ingest.

---

## Purpose

- **Import**: Load pages from a live site (via URL).
- **Transform**: Run your `import.js` rules on the page DOM (select main content, map hero/content to blocks, cleanup nav/footer, etc.).
- **Output**: Produce docx (or HTML/MD) that matches AEM-EDS/UE expectations (sections, blocks, metadata).

Read **[Importer Guidelines](./importer-guidelines.md)** before doing any import; it explains `transformDOM` / `transform`, blocks (e.g. Hero, Metadata), and best practices.

---

## Prerequisites

- **Node.js** (v18+ recommended)
- **AEM CLI** (for the full flow with proxy and UI): [helix-cli installation](https://github.com/adobe/helix-cli#installation)

---

## Option A: Use from an AEM project (recommended)

This is the normal way to use the importer: from the root of your AEM/Helix project.

1. Install the AEM CLI and open the importer:

   ```bash
   aem import
   ```

   This clones this UI repo (if needed) and starts a local server with a **proxy** so the browser can load your live site and run the import.

2. In the UI:
   - **Import** tab: enter page URL(s) (e.g. `https://your-site.com/` or a hero page).
   - **Import file URL**: point to your project’s `import.js` (by convention under `<PROJECT_ROOT>/tools/importer/`).
   - Use **Workbench** to develop `import.js` with one sample URL and auto-reload on save.

3. Your transformation lives in the **project**, not in this repo:
   - Put `import.js` (and any helpers) under your project’s `tools/importer/` (e.g. `tools/importer/import.js`).
   - The proxy maps `http://localhost:3001/tools/importer/*` to that folder.

**Useful options:**

```bash
# Open UI at a specific path
aem import --open "/tools/importer/helix-importer-ui/index.html"

# Cache fetched pages for faster reruns
aem import --cache .cache/

# Use a custom headers file (e.g. auth) for the live site
aem import --headers-file ./headers.json

# Use a different UI branch
aem import --ui-repo https://github.com/adobe/helix-importer-ui#feature-branch
```

---

## Option B: Set up this repo locally (development / debugging)

Use this when you’re changing the **importer UI** or **build** itself (not when you’re only writing `import.js` for a site).

1. **Clone and install**

   ```bash
   cd /path/to/helix-importer-ui
   npm install
   ```

2. **Build**

   - Production (minified):
     ```bash
     npm run build
     ```
   - Development (source maps, no minify, for debugging):
     ```bash
     npm run build:dev
     ```

   Output is under `js/dist/` (e.g. `helix-importer.js`, `spectrum-web-components.js`).

3. **Run the UI**

   The UI is static (HTML + JS + CSS). It’s designed to be served by `aem import` (which also runs the proxy). To work on the UI itself:

   - Build with `npm run build:dev` (so changes in this repo are reflected).
   - From your **AEM project** root run `aem import`; it will use the UI from this repo if it’s placed at the path where the CLI expects it (e.g. `tools/importer/helix-importer-ui`), or use `--ui-repo` to point to your fork/branch.

   To serve **only** this repo (e.g. to check layout) without the proxy, use any static server, for example:

   ```bash
   npx serve .
   ```

   Then open `http://localhost:3000/index.html`. Note: actual import from a live site will fail without the proxy; use Option A for real imports.

4. **Lint and test**

   ```bash
   npm run lint
   npm test
   ```

---

## Where your transformation lives (import.js)

- **When using `aem import` from an AEM project**:  
  Your `import.js` (and optional extra files) lives in **that project**, e.g.:
  - `<PROJECT_ROOT>/tools/importer/import.js`

- In the UI, **“Import file URL”** must point to that file. By convention the proxy serves files under `tools/importer/`, so a typical value is:
  - `http://localhost:3001/tools/importer/import.js`  
  (replace port/host if your CLI uses a different one.)

- **Transformation logic**: Implement either:
  - **One output per page**: `transformDOM` + `generateDocumentPath`, or
  - **Multiple outputs per page**: `transform` returning an array of `{ element, path, report? }`.

See **[importer-guidelines.md](./importer-guidelines.md)** for DOM cleanup, creating blocks (Hero, Metadata, etc.), background images, and reporting.

---

## Quick reference: Hero → AEM block

To turn a live “hero” section into an AEM block, you typically:

1. In `transformDOM` (or `transform`), select the hero container (e.g. `document.querySelector('.hero')`).
2. Build a table that represents the block (e.g. one row for block name, one for content):
   - Use `WebImporter.DOMUtils.createTable(cells, document)` with cells like `[['Hero'], [titleEl, imgEl]]`.
3. Replace or move that content in the DOM so the main content area only contains the structure you want (e.g. `main.prepend(heroTable)` and remove the original hero markup).

Example snippet (see importer-guidelines for full context):

```js
const title = document.querySelector('h1');
const img = document.querySelector('.hero img');
const cells = [['Hero'], [title, img]];
const table = WebImporter.DOMUtils.createTable(cells, document);
main.prepend(table);
```

---

## Troubleshooting

- **CORS / images not loading**: Use `aem import` (proxy). For image URLs, you may need to rewrite `img` srcs to go through the proxy (see importer-guidelines “Images” and “makeProxySrcs”).
- **Page never loads / redirects**: Try “Enable JavaScript” on or off, or “Scroll to bottom”, and adjust “Page load timeout”.
- **Deep JS errors**: Run `npm run build:dev` in this repo and reload the importer UI for unminified stack traces.
- **Changing `@adobe/helix-importer`**: See the “Debugging” section in [importer-guidelines.md](./importer-guidelines.md) for `npm link` and build steps.

---

## Summary

| Goal                         | Action |
|-----------------------------|--------|
| Import from live site → AEM | Use **Option A**: from AEM project run `aem import`, put `import.js` in `tools/importer/`. |
| Develop / debug this UI     | Use **Option B**: `npm install` → `npm run build:dev`, then run `aem import` from project (or serve this repo with `npx serve .` for UI-only checks). |
| Write transformation rules  | Edit `import.js` in your project; use **Import – Workbench** and [importer-guidelines](./importer-guidelines.md). |
