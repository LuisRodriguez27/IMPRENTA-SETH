---
name: project-compilation
description: "Triggers when compiling the project using pnpm build, build:electron for the backend, build:renderer for the frontend, or packaging/distributing the application."
---

# Project Compilation and Packaging Guide

This skill documents how to compile and package the SETH Electron application, covering compilation scripts, output directories, TypeScript build systems, Vite configuration, and Electron Builder settings for distribution.

---

## 1. Compilation Commands Overview

All compilation scripts are managed through the root `package.json` utilizing `pnpm`. The primary commands are:

* **`pnpm build`**: Compiles both backend and frontend environments in sequence.
  ```bash
  pnpm build
  ```
  Runs `pnpm run build:electron && pnpm run build:renderer`.

* **`pnpm build:electron`**: Compiles the Electron main and preload files.
  ```bash
  pnpm build:electron
  ```
  Runs the TypeScript compiler (`tsc`) on the backend codebase.

* **`pnpm build:renderer`**: Compiles the React frontend application.
  ```bash
  pnpm build:renderer
  ```
  Runs the build command inside the `renderer` workspace: `cd renderer && pnpm run build` (which resolves to `tsc -b && vite build`).

* **`pnpm dev`**: Starts a concurrent development workspace running watch mode compilation for Electron and a Vite live reload dev server for the frontend.
  ```bash
  pnpm dev
  ```

---

## 2. Backend Compilation (TypeScript & Electron)

The Electron backend (main process, database layers, IPC handlers) is written in TypeScript and configured under the root `tsconfig.json`.

### Build Specifications:
* **Source Directory**: `electron/**/*`
* **Output Target**: `electron/dist-electron` (as configured by `"outDir": "./electron/dist-electron"` in the root `tsconfig.json`).
* **Format**: CommonJS format is outputted via `"module": "CommonJS"` to align with standard Electron main process loading.
* **Compilation Command**: Executing `tsc` compiles the TypeScript files into executable JavaScript.

---

## 3. Frontend Compilation (Vite & React)

The frontend application resides inside the `renderer/` directory and is built using Vite, TailwindCSS (v4), React, and TanStack Router.

### Build Specifications:
* **Source Directory**: `renderer/src/**/*`
* **Output Target**: `renderer/dist` (as configured by `build.outDir: 'dist'` in `renderer/vite.config.ts`).
* **Vite Plugins & Routing**:
  * `@tailwindcss/vite` compiles styles.
  * `TanStackRouterVite()` handles code generation for routes (declarations in `renderer/tsr.config.ts`).
* **Electron Asset Loading**:
  * Critical setting: `base: './'` in `renderer/vite.config.ts` ensures that all compiled assets use relative paths. This allows the Electron file protocol (`file://`) to resolve resources locally within the packaged application without referencing root-absolute paths.

---

## 4. Production Packaging and Distribution

To bundle the application into a distribution installer (e.g., EXE, AppImage, DMG), use `electron-builder`.

### Distribution Commands:
* **`pnpm dist`**: Packages the compiled code into standard platform binaries.
* **`pnpm dist:win`**: Explicitly packages the application as a Windows installer.
* **`pnpm dist:git`**: Packages the Windows installer and publishes the release assets directly to GitHub.

### Bundled Resources (`package.json` "build" config):
Only specific directories are included in the packaged application:
* `electron/dist-electron/**/*` (compiled backend)
* `renderer/dist/**/*` (compiled frontend assets)
* `node_modules/**/*` (production dependencies)
* `.env` (environment configuration)
* `package.json` (metadata & entry points)

---

## 5. Troubleshooting & Rebuilds

* **Stale Builds**: If you modify the database schema or IPC interfaces and do not see the changes reflected in Electron, stop the active dev servers, run a clean `pnpm build`, and restart.
* **Native Node Modules Mismatch**: When Electron encounters errors relating to native modules (like SQLite or bcrypt wrappers), trigger an electron-native modules rebuild:
  ```bash
  pnpm rebuild
  ```
  This runs `electron-rebuild` to recompile native binaries matching the active Electron runtime ABI header.
