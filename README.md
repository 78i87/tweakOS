# Web OS

A small Next.js-based “Web OS” that mimics a desktop experience. Apps register themselves with a central registry, windows are managed via Zustand, and the desktop renders the running windows on top of a wallpaper with a dock and icons.

## Getting Started

1. Install dependencies (once): `npm install`
2. Boot the dev server: `npm run dev`
3. Visit `http://localhost:3000`

Other scripts:

```
npm run build    # production build
npm run start    # serve the build
npm run lint     # eslint (Next.js config)
```

## Project Layout

- `src/app` – Next.js app router entry (`page.tsx` imports the manifest so default apps are registered before the desktop renders).
- `src/apps` – individual app implementations (e.g., `notepad/NotepadApp.tsx`) plus `manifest.tsx`, which is the single source of truth for built-in apps.
- `src/components/desktop` – desktop shell widgets (`Desktop`, `Window`, `Dock`, etc.).
- `src/lib` – shared state and helpers: `windowStore.ts` (Zustand), `appRegistry.ts`, types, and `useWindowActions.ts` for deduplicated window actions.
- `public` – wallpaper and other static assets.

## Adding An App

1. Create a folder under `src/apps/<your-app>` exporting a component that matches `AppComponentProps`.
2. Import that component and any icon into `src/apps/manifest.tsx`, append it to `defaultApps`, and the registry will pick it up automatically.
3. Desktop widgets (`DesktopIcon`, `Dock`) already react to registered apps and window state, so the new app becomes available without extra wiring.

`appRegistry` also exposes `makeAppFromHTML` for dynamic, AI-generated HTML apps when you need to create a window at runtime.
