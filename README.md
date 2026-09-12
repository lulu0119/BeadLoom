<p align="center">
  <img src="./apps/web/public/android-chrome-192x192.png" width="96" alt="BeadLoom logo" />
</p>

<h1 align="center">BeadLoom</h1>

<p align="center">
  豆织工坊 — a bead chart you talk to, then keep editing by hand.
</p>

<p align="center">
  <a href="./README.zh-CN.md">简体中文</a>
  ·
  <a href="#what-is-beadloom">What is BeadLoom?</a>
  ·
  <a href="#try-it-locally">Try it locally</a>
  ·
  <a href="#development">Development</a>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-black" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61dafb" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-ready-3178c6" />
</p>

## What Is BeadLoom?

BeadLoom (豆织工坊) is an agent-first bead-chart editor. You land on a 32×32 board with chat already open. Type what to draw, or drop a photo onto the composer — the agent paints with the same tools as the human HUD.

The library, size chip, palette, and undo stack stay human. Charts save in this browser.

## Try It Locally

```bash
pnpm install
pnpm dev
```

Then open the local web app from the URL printed by Next.js. LLM settings (base URL, model, API key) live in the in-app settings panel.

## Development

This repository is a pnpm workspace. The web app lives in `apps/web`, and shared packages live in `packages/*`.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
