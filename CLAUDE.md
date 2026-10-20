# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, single-page informational website for Virginia Tech's Financial Planning & Wealth Management (CFPF) major and its student-run Financial Planning Society (FPS) chapter. No framework, no build step, no package manager — plain HTML/CSS/JS served directly.

## Running locally

There is no build/dev-server tooling configured. Open `index.html` directly in a browser, or serve the directory statically, e.g.:

```
python3 -m http.server 8000
```

There is no test suite, linter, or formatter configured in this repo. The site is deployed via GitHub Pages from the `main` branch root.

## File structure

- `index.html` — the entire page markup, one file with six `<section>`s (`#hero`, `#stats`, `#about`, `#fps`, `#board`, `#contact`) plus a slide-out `#side-nav`.
- `style.css` — all styling. CSS custom properties for the VT maroon/orange palette are defined once at the top of `:root` and used throughout; change colors there rather than hardcoding hex values in rules.
- `script.js` — all page behavior, organized as independent, self-contained blocks (see below), not modules. Loaded after `firms-data.js` at the bottom of the HTML body.
- `firms-data.js` — a single global `firms` array of `[name, city, state, lat, lon, websiteUrl]` tuples, one per alumni employer. This is the dataset backing the alumni firm map. Loaded before `script.js` since the map IIFE reads the global `firms`.
- `assets/` — campus/portrait photography (jpg/png) referenced by relative path from the HTML/CSS.

## Architecture notes

### `script.js` structure
The file is a sequence of independent behavior blocks with no shared module system — each is a top-level IIFE or a flat sequence of DOM queries/listeners:
1. Hamburger / side-nav open-close logic
2. Scroll-progress bar + solid-hamburger-on-scroll
3. Scroll-spy (`IntersectionObserver`) that highlights the active side-nav link
4. Reveal-on-scroll animation trigger (adds `.in` class when elements enter viewport)
5. Animated stat counters (`data-count` / `data-suffix` attributes drive count-up animation)
6. The alumni firm map (large IIFE at the bottom) — see below

When adding new interactive behavior, follow this pattern: a small, self-contained block near the bottom of the file, not a new abstraction layer.

### Alumni firm map (`script.js`, bottom IIFE)
This is the most complex piece of logic in the codebase:
- Uses D3 v7 + TopoJSON (loaded via CDN `<script>` tags in the HTML, not npm) to render a US states/counties choropleth (`us-atlas@3/counties-10m.json`, fetched from jsdelivr at runtime) inside `#usa-map`.
- Groups the flat `firms` array by `city, state` into `locations`, each holding its firms, lat/lon, and a projected `{x, y}` via `d3.geoAlbersUsa()`.
- **Clustering**: `computeClusters(scale)` does an agglomerative merge of nearby location dots — any two whose rendered circles would overlap (radius depends on firm count, scaled by current zoom `k`) get merged into one cluster, recursively. This runs on every zoom/pan tick, not just once, so clusters split apart as the user zooms in and re-merge on zoom out.
- Clicking a single-city dot opens the side panel (`#panel`) listing that city's firms (`showPanel`); clicking a multi-city cluster dot zooms in further, or — once already at max zoom — opens a merged panel across all its cities (`showMergedPanel`).
- Panel firm list supports client-side substring search (`#firm-search`, shown only when a city/cluster has >5 firms) via `filterFirms`.
- Zoom/pan is a `d3.zoom()` behavior with `scaleExtent([1, 30])`; county borders fade in only above zoom level 3, city-name labels above zoom level 4.

If you add or edit alumni employers, edit `firms-data.js` only — the map logic derives everything else (grouping, clustering, panel content) from that array. Keep the six-element tuple shape `[name, city, state, lat, lon, website]` (empty string `""` for unknown website).

### Design system
Colors, type, and easing are centralized as CSS custom properties in `style.css` `:root` (VT maroon `#630031`, orange `#cf4420`, stone/ink neutrals, Source Serif 4 for headings, Inter for body). Reuse these variables rather than introducing new colors/fonts.

## Content accuracy

Stats, curriculum facts, and outcomes figures in `index.html` (employment rate, salary, alumni counts, course lists, credit hours) are sourced from the VT undergraduate catalog and internal alumni tracker data, cited inline via `.fine-print` notes in each section. When updating these numbers, keep the citation text next to them accurate/current rather than removing it.
