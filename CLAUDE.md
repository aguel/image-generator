@AGENTS.md

# Darkroom: notes for Claude

Cinematic image generator. Next.js 16.4 (App Router, `cacheComponents: true`), React 19.3, Tailwind 4, Remotion 4.
See `README.md` for features, API and data layout. This file covers the conventions to keep when you change code.

## Commands

- `npm run dev`: dev server on `APP_PORT` from `.env`, via `scripts/serve.mjs`. Do not call `next dev` directly.
- `npm run build` / `npm start`: production build, then serve on `APP_PORT`.
- `npx tsc --noEmit` and `npx eslint .` must stay clean. Run `npx next typegen` first if `RouteContext` / `LayoutProps` are missing.
- `npm run icons`: regenerate every favicon asset from `scripts/make-icons.mjs`.

## Environment

- `APP_PORT`: required. `.env` may contain spaces around `=`; `serve.mjs` tolerates them.
- `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_COMPLETION_MODEL`: read only on the server (`lib/server/openai.ts`,
  `lib/server/enhance.ts`). Never expose the key to the client; `/api/config` returns only model names, limits and a boolean.
- `GENERATION_CONCURRENCY` (default 2) and `GENERATION_QUEUE_SIZE` (default 20): read by `limits()` in `lib/server/queue.ts`.
- Optional: `OPENAI_IMAGE_QUALITY` (forwarded as `quality`), `BACKUP_TOKEN` (locks the backup API behind a token).

## Architecture rules

- **Everything goes through the queue** (`lib/server/queue.ts`). It is in memory, kept on `globalThis` so dev reloads don't
  create a second one. Each job generates one image (`n: 1`). `enqueue()` is all-or-nothing and throws `QueueFullError`
  (→ HTTP 429) when the items don't fit. A job that can start immediately doesn't use a waiting slot. Never call
  `generateImage()` directly from a route; use `enqueue()` (plus `waitFor()` if the route must block).
- **Client queue state** comes from `useQueue()` (`lib/useQueue.ts`). It polls `/api/queue` every second while jobs are active
  (every 5 seconds otherwise) and calls `onImage` once for each new finished image. Studio "batches" only hold job ids;
  tile state is always read from the queue snapshot.
- **Prompt enhancement** (`lib/server/enhance.ts`) calls Chat Completions with a strict `json_schema` response format,
  falls back to `json_object` on a 400, and tolerates stray text around the JSON. The system prompt keeps style and camera
  words out of the generated prompts, because the style preset adds those.
- **Server code** lives in `lib/server/*` and starts with `import "server-only"`. Library writes go through `withLock()` in
  `store.ts` because parallel generations write `library.json` at the same time.
- **Route handlers** that read the filesystem at request time call `await connection()` (GET) so they are never prerendered
  under Cache Components. Dynamic segments use `RouteContext<"/path/[id]">`, and `params` is a Promise.
- **IDs** are validated with `isSafeId()` before touching the filesystem.
- **Backup API** endpoints must call `guardInternal(request)` first.

## Motion: everything animates with Remotion

- **Self-playing visuals** (loaders, activity indicator, dialog glyphs, logo, empty state) are compositions in
  `components/remotion/compositions.tsx`, rendered through `<Stage>` (a `@remotion/player` wrapper with all controls off).
  Composition sizes are fixed; `<Stage>` scales them to its container through `aspect-ratio`.
- **UI motion** uses Remotion's `spring()` / `interpolate()`, driven by a 60fps rAF clock in `lib/motion.ts`:
  - `useReveal` / `<Reveal>` for entrances. It writes styles directly, so there are no re-renders. `delay` is in frames.
  - `usePresence(open)` for mount and unmount transitions (dialogs, drawer, lightbox, toasts). It returns `[progress, rendered]`.
  - `useSpringValues` for zoom and pan.
- Do not add CSS keyframe animations or another animation library. New activity indicators use `<Activity>`.
- **Hover physics** come from `<HoverFX />` (`components/ui/HoverFX.tsx`), mounted once in `Studio`. It uses event
  delegation for `button, a[href], [role=button|tab|radio|checkbox], [data-hover]` and springs the individual CSS
  `scale` / `translate` properties, so it never fights an element's own `transform`. Mark an element with
  `data-hover="off"` if it has its own hover animation (as `ImageCard` does). Do not set inline `scale` / `translate` on
  interactive elements yourself.
- **Confirmation dialogs** (`components/ui/ConfirmDialog.tsx`) render the whole card as a Remotion composition
  (`ConfirmScene`) inside a `<Player>`. Card, glyph, title, body and buttons are choreographed with `useCurrentFrame()`.
  The buttons are real DOM buttons passed as callbacks through `inputProps`. The composition height comes from
  `estimateHeight()`, so keep titles and bodies short. Every confirmation goes through `setConfirm({...})` in `Studio.tsx`.
- Respect `prefers-reduced-motion`. The hooks already short-circuit to the end state.

## Layout and design system

- **One view, no page scroll (lg and up).** The root is `lg:h-dvh lg:overflow-hidden`. The Studio view is a two-column bento
  (Composer on the left, canvas on the right) that must fit the viewport. Below `lg` it stacks and scrolls normally.
  When you add controls, keep them compact, and check 1280×720 and 1440×900 for `scrollHeight === innerHeight`.
  The `short:` variant (desktop and height ≤ 820px, defined in `globals.css`) tightens spacing on short screens.
- **Copy and type.** Use plain words ("Generate", "Aspect ratio", "Number of images", "Backups"), not film jargon. Body text
  is 15px. Control headings use `.eyebrow` (13px semibold) and metadata uses `.label` (12px). Avoid uppercase micro text.
- **Menu.** `NavIsland` is a floating pill with four views (**Studio**, **Prompts**, **Queue**, **Gallery**), switched in
  client state (`view` in `Studio.tsx`). Prompts-menu state (`PromptLab`) lives in `Studio`, so it survives switching views. The Studio canvas shows only the latest roll, fitted with
  `FitGrid` (it chooses the column count that gives the largest tiles with no overflow).
- **Gallery** (`Gallery.tsx`) is a paginated bento (9 per page: one 2×2 hero plus eight cells; sparser pages use smaller
  grids through `bentoFor`). It has aspect and style filters, ←/→ paging, and a hero that alternates sides on each page.
  Cells crop with `object-cover`, and the lightbox shows the full frame.
- **Tokens** live in `app/globals.css`: `--paper` (white), `--canvas`, `--ink`, `--ink-soft`, `--ink-faint`, `--hair`, `--amber`,
  `--amber-soft`, `--teal`, `--danger`. They map to Tailwind (`bg-paper`, `text-ink-soft`, …). Do not hard-code hex in
  components.
- **Double-bezel** containers use `.bezel` (outer tray) with `.bezel-core` (inner white plate); override the radius with `[--r:30px]`.
  Use `.eyebrow` for control-group headings and `.label` for secondary metadata.
- **No grey fills on controls.** Segmented controls use `.seg` (a white track on a hairline ring) with the active option in
  solid ink (`bg-ink text-paper`). Small pills such as suggestions, status and secondary actions use `.chip`. Selectable
  option tiles use `.tile`. Disabled primary buttons become a white card with faint text and an amber icon tile, not a
  faded grey pill. All of these are defined in `globals.css`.
- The UI does not show model names (`/api/config` still returns them for scripts).
- **Buttons**: secondary actions are pills. The Generate action is a full-width ink block (rounded 20px) with a leading icon
  tile, a two-line label (action and current settings), a ⌘↵ hint, and a spring-driven amber progress line while generating. CSS transitions use `ease-fluid`
  (`cubic-bezier(0.32,0.72,0,1)`) with 500ms durations, and presses use `active:scale-[0.98]`.
- **Type**: Geist for everything readable (headings semibold with slight negative tracking). Instrument Serif
  (`font-display`) appears only in the wordmark, and Geist Mono only for the model id. Icons are 1.25px hairline strokes
  (`components/studio/icons.tsx`).
- Remotion compositions are tinted for paper (`PAPER`, `INK` constants). `<Activity>` takes `tone` and `blade`; inside ink
  buttons, pass `tone="#ffffff" blade="#0e0e0d"`. `<Stage cover>` resizes a composition to fill its box.
- The floating Next.js dev indicator is disabled in `next.config.ts` (`devIndicators: false`). Keep it off.

## Styles

`lib/styles.ts` holds the presets. **Cinematic** reproduces the reference photos: low-key practical light (fluorescent and
tungsten), an orange-and-teal grade, deep blacks with a slight matte lift, high micro-contrast, a razor-thin focus plane with
creamy bokeh, and gritty, lived-in environments. To tune it, edit `CINEMATIC_TEMPLATE`. Keep it subject-agnostic: the user's
prompt supplies the subject, and the template supplies only look and feel.

## Data

`data/` (git-ignored) holds `library.json`, `images/` and `backups/`. Never delete `data/` or the snapshots in it unless
the user asks.
