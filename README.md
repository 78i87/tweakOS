# Tweak OS

## Inspiration
The theme was "When Worlds Collide". So we decided to see how an AI agent from the future would act with an AI agent of today if they coexisted on the same desktop\. The thing is, the AI agent from the future has never heard of a GUI, seemingly because of brain\-chip developments\.

## What it does
We built a sandbox desktop\.

We have the AI from the future, which lives in the CLI\. We will call it **CAI**\. It can run commands automatically, and we can interact and talk with it\.
We have an AI from today, which lives on a higher UI level\. We will call it **GAI**\. It can edit the UI of the browser and "imagine" new apps on the fly (e\.g\., "imagine Flappy Bird but with a penguin")\.

The GAI can speak to us with TTS, while the CAI can only speak with text\. They can both see the desktop and make comments on the desktop status non\-deterministically\.

The two AIs can have cool interactions with each other and can sometimes argue about the usefulness of GUIs\.

There are hidden Easter egg interactions (e\.g\., if you drag the CLI terminal too much)\.

There are built\-in apps in the sandbox:
- Notepad
- Terminal (where CAI lives)
- Browser
- Cookie Clicker

The terminal actually works with its own sandbox commands\. The browser proxies on the server side to embed webpages in an iframe\. The GAI can reimagine these websites (e\.g\., "imagine this website in 2040")\. The Cookie Clicker was just for fun :\)

## How we built it
We used a **Next\.js** tech stack\. We used a few external libraries for animations\. We used the **Google Gemini API** for the AI agents and the **ElevenLabs API** for TTS\.

## Challenges we ran into
- The built\-in browser **doesn't** always render the webpages properly\.
- There were some time constraints on some features, so we **couldn't** polish them\.

## Accomplishments that we're proud of
- The "imagine" feature was very fast and **optimized**; so fast that it **generated** web pages almost **instantly**\.
- The **Easter egg** and **AI** interactions are very funny\.

## What we learned
AI output filtering and token **optimization** were important in this project to ensure we **don't** have an overbearing AI agent and we are cost\-efficient\.

## What's next for TweakOS
- Allow **reimagining** of existing windows\.
- Allow **reimagining** of the actual desktop UI (e\.g\., "make my wallpaper blue")\.
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
3. Desktop widgets (desktop icons + dock) already react to registered apps and window state, so the new app becomes available without extra wiring.

`appRegistry` also exposes `makeAppFromHTML` for dynamic, AI-generated HTML apps when you need to create a window at runtime.
