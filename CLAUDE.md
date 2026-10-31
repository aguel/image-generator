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
- **Detail pass**: every generated image goes through `finishImage()` (`lib/server/finish.ts`, `sharp`) before it is saved: a
 light luminance unsharp mask whose strength comes from `StylePreset.finish` (`ultra` Portrait / Focus, `crisp` Cinematic / Solitude / Landscape, `natural` Melancholy /
 Director's Cut, `gentle` Moonlight, `none` Night Paint / Raw). It then strips all metadata (`stripPngMetadata`):
 only IHDR/PLTE/tRNS/IDAT/IEND and colour chunks are kept, so C2PA `caBX` content credentials, EXIF, XMP, text and
 time chunks never reach `data/images/`. Keep the sharpen below the level that makes halos.
- **Backup API** endpoints must call `guardInternal(request)` first.
- **Regenerating an image** replaces it. `regenerate` in `Studio.tsx` enqueues one job from `ImageRecord.prompt`, `styleId` and `aspect` with `replaces: image.id`. Once the new
 image has saved, `run()` calls `replaceImage()` in `store.ts`, which keeps the old library position and unlinks the old file last, then `forgetImage()`. Failed or cancelled jobs leave the original alone. `enqueue()` allows
 one active job per `replaces` (a second request returns the existing job). `onImage` swaps the record in `library` and in an open viewer, and `ImageCard` shows the dot wall while `regenerating`.
- **Deleting an image** (`DELETE /api/images/:id`) also calls `forgetImage()` in the queue, so the job leaves the Queue
 history; `Studio` filters deleted ids from the snapshot until the next poll.

## Motion: everything animates with Remotion

- **Self-playing visuals** (loaders, activity indicator, dialog glyphs, logo, empty state) are compositions in
  `components/remotion/compositions.tsx`, rendered through `<Stage>` (a `@remotion/player` wrapper with all controls off).
  Composition sizes are fixed; `<Stage>` scales them to its container through `aspect-ratio`.
- **Studio tiles** (`ImageDraft`) are a wall of small coloured dots on a black (`INK`) background for the idle, waiting and
  generating states; the developing `ImageCard` is black behind the reveal too, so no pale flash shows. Dots are drawn on a canvas from shared per-colour sprites (`getDotSprites`), which keeps several tiles cheap. The canvas renders 1:1 with device pixels at a whole-pixel `DOT_PITCH`, measured from its on-screen box, because a fixed-size canvas scaled by the Player shows moiré. Colours come from the fixed
  `DOT_HUES` wheel, not the style's `swatch`, so every style reads as colourful; `latentSeed(styleId, index)` sets each
  tile's starting hue and timing. Waves swell the dots, a diagonal band crosses them (offset per tile, so neighbours ripple
  rather than flash together) and single dots twinkle. Per-mode feel lives in `DRAFT_LOOK`: `idle` is dim and unhurried;
  `queued` is grey and nearly still, with an "Nth in line" chip; `running` is vivid and quick, and on the job's `startedAt`
  clock more of the wall lights up. A finished image is revealed by `DevelopingImage` (`Tile.tsx`): a blurred copy fades in, then the sharp image
  sharpens into place from the top down behind a feathered edge (`revealProgress`, `REVEAL_FEATHER`, `REVEAL_FRAMES`).
  Reduced motion holds a still frame and skips the reveal.
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
  (`ConfirmScene`) inside a `<Player>`. Layout: a top **stage** (the `image` being acted on, opened with a shutter-style
  clip wipe and a slow settle, with the icon badge overlapping its edge; or, with no image, the animated `ConfirmGlyph` on a
  flat tint with looping ripples), then the title (words rise one by one), the body, an optional `details` row (up to three
  label/value pairs), and full-width Cancel (Esc) / confirm (↵) buttons. The timeline is documented on `ConfirmScene`.
  The buttons are real DOM buttons passed through `inputProps`. The composition height comes from `estimateHeight()`,
  so keep titles and bodies short. Every confirmation goes through `setConfirm({...})` in `Studio.tsx`; pass `image`
  and `details` whenever they exist.
- Respect `prefers-reduced-motion`. The hooks already short-circuit to the end state.

## Layout and design system

- **One view, no page scroll (lg and up).** The root is `lg:h-dvh lg:overflow-hidden`. The Studio view is a two-column bento
  (Composer on the left, canvas on the right) that must fit the viewport. Below `lg` it stacks and scrolls normally.
  When you add controls, keep them compact, and check 1280×720 and 1440×900 for `scrollHeight === clientHeight` on the
  `lg:h-dvh` root itself. The document always reports a fit because that root hides its overflow, so also confirm the Generate button is visible.
  The `short:` variant (desktop and height ≤ 920px, defined in `globals.css`) tightens spacing on short screens and hides the style cards' taglines.
- **Copy and type.** Use plain words ("Generate", "Aspect ratio", "Number of images", "Backups"), not film jargon. Body text
  is 15px. Control headings use `.eyebrow` (13px semibold) and metadata uses `.label` (12px). Avoid uppercase micro text.
- **Menu.** `NavIsland` is a floating pill with four views (**Studio**, **Prompts**, **Queue**, **Gallery**), switched in
  client state (`view` in `Studio.tsx`). Prompts-menu state (`PromptLab`) lives in `Studio`, so it survives switching views. The Studio canvas shows only the latest roll, fitted with
  `FitGrid` (it chooses the column count that gives the largest tiles with no overflow).
- **Gallery** (`Gallery.tsx`) is a paginated bento (9 per page: one 2×2 hero plus eight cells; sparser pages use smaller
  grids through `bentoFor`). It has a style filter (no size filter), ←/→ paging, and a hero that alternates sides on each page.
  Cells crop with `object-cover`, and the lightbox shows the full frame.
- **Tokens** live in `app/globals.css`: `--paper` (white), `--canvas`, `--ink`, `--ink-soft`, `--ink-faint`, `--hair`, `--amber`,
  `--amber-soft`, `--teal`, `--danger`. They map to Tailwind (`bg-paper`, `text-ink-soft`, …). Do not hard-code hex in
  components.
- **Double-bezel** containers use `.bezel` (outer tray) with `.bezel-core` (inner white plate); override the radius with `[--r:30px]`.
  Use `.eyebrow` for control-group headings and `.label` for secondary metadata.
- **Pill surfaces** (`globals.css`): `.chip` is a raised white pill with a top highlight and a soft shadow; `.island` is a
  larger raised capsule for header status docks (`BatchStatus`: a spring-animated progress ring, two-line status, and a
  Gallery button with a nested arrow); `.action-pill` (with `.danger`) is a pill holding an icon `.disc`, used for
  "Clear list" and "Cancel all" (the disc fills red on hover).
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

## Quote titles

- `lib/server/quote.ts` (`titleFor`) asks `OPENAI_COMPLETION_MODEL`, through the shared `chatJson()` helper in
 `lib/server/enhance.ts`, for `{ text, source, kind }`. It prefers a famous person's quote (kind `quote`) and falls back
 to a Bible verse (kind `verse`); the line must be uplifting, tied to something concrete in the photo, and short
 (ideally 3–10 words, `MAX_WORDS` 12; a longer pick is sent back once for a shorter one). The finished
 image is sent with the request (`chatJson({ image })`, low detail) so the line matches the frame; if the vision call
 fails it retries from the prompt alone. The system prompt forbids invented or misattributed wording. It returns null on
 any failure, so a missing title never blocks an image. Older records may still carry `proverb` / `original` kinds.
- The queue writes the title right after `generateImage` returns (it needs the pixels) and stores it on
 `ImageRecord.title`. `POST /api/images/:id/title` rewrites it via `titleForRecord()` (reads the stored file), passing
 the current title and `ImageRecord.pastTitles` (last 8) as lines to avoid, so "New quote" always changes; it then
 calls `updateImage` in `store.ts` and `refreshImage()` in the queue so finished jobs carry the new title. `Studio` keeps a `titles` override map so tiles built from queue snapshots show rewritten titles.
- Cards show the title (falling back to the prompt) with its source. The viewer shows it large above the prompt, with
  "New quote" / "Write a title".
- Backfill: `POST /api/images/titles` titles every untitled image (3 at a time) and is triggered by the Gallery's
  "Add titles to N images" action pill, which only appears while some images have no title.

## Views

- **Studio**: the Composer on the left, and the latest batch on the right. `FitGrid` anchors tiles to the top-left.
- **Prompts** (`PromptsView`): an idea bar at the top, a card grid of results (no index numbers), and a floating action bar
  (select all / deselect all, style, aspect, images each, Queue). Enter submits the idea.
- **Queue** (`QueueView`): a header with "Cancel waiting" (soft red) and "Clear finished" (white) `QueueAction`
 buttons, each a 52px pill with a two-line label (action plus the job count it touches) and a trailing icon disc that fills
 on hover; when there is nothing to act on they read "Nothing waiting" / "Nothing to clear" as quiet disabled cards; a summary bar with
  per-slot segments for concurrency, a waiting-capacity bar, and a stack of recent thumbnails; and one job list with
  filter tabs (All / Active / Done / Failed), sticky group headings (In progress / Up next / Finished) and aligned
  columns (thumbnail, prompt, status pill, time, actions) that share the `ROW` grid template.
- **Scrolling lists** that contain hoverable cards keep at least 8px of inner padding on every side (`pt-2 px-4`), so the
  `HoverFX` lift and scale never clip. Wide cards only lift 1px.
- **Gallery**: a paginated bento.

## Styles

`lib/styles.ts` holds the presets: Cinematic, Moonlight, Night Paint, Melancholy, Director's Cut, Solitude, Landscape, Portrait, Focus and Raw.
**Focus** (internal id `heritage`, kept because saved images store it) is a fine-art environmental portrait, reverse-engineered from four references documented above its template: one or two people in traditional dress, framed from about the knees or waist up by default because a full-body face is too few pixels to hold fine detail, a studio-quality soft key on location (people about two stops above a low-key slate-teal and moss background), warm brown skin, and rich colour reserved for textiles. A "Human detail" line and the `ultra` detail pass make every person ultra-sharp. It is composed for a horizontal frame (the references are mostly vertical, but the user wants landscape): its `aspect: "landscape"` switches the pickers to Landscape when chosen, and it passes a darker background to `subjectHdr(...)`.
**Portrait** is an extreme close-up in a horizontal frame (its `aspect: "landscape"` switches the pickers to Landscape when chosen, and the user can still change it): a studio setup of a raking side key plus a "Fill and ambient light" line that opens up the dark areas of the person (never the near-black background), a heavily muted grade with chocolate brown skin unless the prompt names another complexion (a dark complexion, not dark exposure), high contrast reserved for the "Facial contours" line (skin between the contours, hair, hands and clothing stay moderate),
and every pore and wrinkle resolved. It uses `peopleSharp(...)` but skips `SUBJECT_HDR` and `creamyBokeh`, and its detail pass is its own `ultra` level. `PORTRAIT_SMOKE` (emphasised, sculptural smoke) is added only when `SMOKE_SOURCE` finds smoke
or something that makes it in the prompt; every other Portrait lists smoke in its Avoid line.
**Landscape** is professional Philippine landscape photography: cinematic realistic sky, a smooth editorial HDR balance,
and front-to-back sharpness at f/8–f/11 from hyperfocal focus (so it deliberately skips `PEOPLE_SHARP` / `creamyBokeh` and
bans bokeh); its detail pass is `crisp`. Every style, Raw
included, puts `PHILIPPINES` right after the subject (the scene is in the Philippines and every person is Filipino or
Filipina unless the prompt names another country or nationality; Melancholy's village and Moonlight's fallback lagoon are
Philippine too), and the Prompts enhancer writes Filipino people and Philippine places by default. `PHILIPPINES` also
sets Filipino headwear (rounded-crown buri/straw farmer's hat, buntal hat, cap, bimpo towel) and every Avoid list includes
`NOT_PHILIPPINES` (no pointed conical Vietnamese nón lá hats or other countries' clothing unless described). Every style also ends with `NATURAL_ANATOMY` (correct heads, limbs, hands, feet and faces; believable interactions and geometry)
and starts its Avoid list with `AI_ARTEFACTS` (extra limbs or heads, distorted faces, fused fingers, duplicated people,
garbled text); Raw appends only those two lines to the prompt. **Director's Cut** (wide workshop film still, dim god rays through thin haze, an overall strongly rustic, matte tone (aged wood, rust, burnt sienna and ochre, dusty parchment lights, dark umber background, no golden glow, cool cast or flat sepia filter), earth-toned haze and visible dust speckles in the same colours (airborne particles, kept off faces), a "Darkened surroundings" line like Focus (a pool of light on the people, the scene falling into shadow around them), with a grain-free digital finish and no clarity boost; a "Fill light" line keeps the characters clearly the
brightest, clearest part and keeps that light off the background, which falls off into umber that holds faint detail) and **Solitude** (one person alone in any setting the prompt names, backlit sunburst through leaves and mist; it no longer forces a river) each document their references in the comment above the template. **Melancholy** reproduces golden-hour village references (backlit low sun, dusty haze and god rays, amber/honey palette with muted sage foliage, lifted soft shadows, nostalgic quiet moments, subjects often from behind). **Moonlight** (night landscapes) is tuned for realism: a true-to-life long exposure under a full moon (natural
halo, deep blue sky, real rather than glowing water, warm window and lantern light, foliage framing, deep depth of field), with a
balanced HDR finish that lifts the subject (no silhouettes), low-to-medium contrast, open shadows with no crushed blacks,
no vignette, natural saturation, and a subtle painterly touch (smooth tones, softened distant detail, no brushstrokes). The setting and viewpoint always come from the prompt (farm, village, interior looking out...); the lagoon
is only the fallback when no place is named, and water appears only when described. `MOONLIGHT_SCENE` holds the shared
setting and composition lines; Night Paint keeps its own glowing, magical
moon, water, lighting and palette lines. **Melancholy** uses `BRIGHT_HDR`, a
natural HDR finish that lifts the backlit subject to a clear exposure while the bright background (sun, sky, haze,
windows) keeps its detail; it also adds bounced fill on the subject and avoids silhouettes and blown-out backgrounds.
**Solitude** uses its own "Exposure" line instead: the person is brightest and the background sits about a stop lower in calm,
soft light (a small, mostly hidden sun, thin translucent mist, no glare or hazy-white wash). **Director's Cut** also has its own
"HDR exposure" line, because `BRIGHT_HDR`'s airy, luminous look fights its muted grade: characters lifted, background about two stops lower and dark. It calls `subjectHdr(...)` with that darker background, because the default `SUBJECT_HDR` forbids darkening it. It favours
photorealistic texture over punch: a soft photographic curve, low local contrast on faces and fabric, a "Texture and realism" line,
and `peopleSharp(...)` called with gentle micro-contrast. **Cinematic**, **Melancholy**, **Director's Cut**
and **Solitude** also share three blocks defined above `CINEMATIC_TEMPLATE`: `SUBJECT_HDR` (an extra HDR lift on every person while
the background keeps its own balanced exposure), `PEOPLE_SHARP` / `peopleSharp(finish)` (every person and what they hold ultra-sharp and photorealistic, from a flagship
body and premium prime stopped down to f/4–f/5.6; `finish` sets how crisp the micro-contrast is) and `creamyBokeh(tones)`
(ultra-realistic, creamy bokeh with real lens texture in each style's own colours, the background placed far enough back to
melt away at that aperture). Edit them once to change them everywhere: Moonlight and Raw use both too; Night Paint and Landscape do not; Focus uses both; Portrait uses only `peopleSharp`. **Melancholy** and **Solitude**
also add `SOFT_BACKGROUND_ONLY`: haze, mist, glow, faded tones and blur live only in the background scenery; the people and the
ground right around them stay crisp, with clear air in front of them and no whole-image soft-focus filter. Melancholy's
haze is deliberately dramatic (thick, layered golden haze and bold god rays, kept behind the people). Solitude frames the
person medium (a third to half of the frame height), focuses on the eyes at f/2.8, and has a "Face fill light" line so the
backlit face stays evenly lit. The Composer shows every style as a
card (style icon, name, and a tagline except on `short:` screens) in a two-column grid; an odd last card spans the row. The prompt card is capped
(`lg:max-h-[200px]`) so the style cards fit; there are no prompt suggestions. The Prompts action bar uses the compact
`StylePicker` dropdown (`components/studio/StylePicker.tsx`). Every style has its own glyph in `STYLE_GLYPHS`
(`components/studio/icons.tsx`), drawn by `<StyleIcon>` in the style's accent on its darkest swatch tone; a new style
needs a glyph there. A retired id (for example an old "dramatic" record) falls back to
Cinematic through `getStyle()`. **Cinematic** is framed as a wide-angle environmental shot (24–35mm, subject full-body or knees-up taking a third to half of the frame height, never a tight portrait) and reproduces the reference photos: low-key practical light (fluorescent and
tungsten), a cool teal foreground over a mostly neutral, dark background with only a faint teal hint (skin stays natural, slightly cooled), an ultra-sharp subject opened up by soft ambient fill on the face and body, deep blacks with a slight matte lift,
high micro-contrast, people sharp at f/4–f/5.6 with creamy, textured bokeh behind them, and a minimal, uncluttered background (no crowds or busy
props behind the subject; grit stays on the subject and their surface). A "Fill and ambient light on the subject" line keeps every person evenly filled (shadows about a stop below the key,
visible eyes and catchlights); the low-key mood stays in the background. To tune it, edit `CINEMATIC_TEMPLATE`. Keep it subject-agnostic: the user's
prompt supplies the subject, and the template supplies only look and feel.

## Data

`data/` (git-ignored) holds `library.json`, `images/` and `backups/`. Never delete `data/` or the snapshots in it unless
the user asks.
