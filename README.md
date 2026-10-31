# Darkroom — Cinematic Image Studio

A clean, light-mode image generator built on **Next.js 16**, **React 19**, **Tailwind CSS 4** and **Remotion**.
Describe a subject, pick a style, frame and number of exposures, and Darkroom develops each image in parallel
with its own animated "developing" tile. Images are generated with the OpenAI Images API.

On desktop every screen fits in a single view, with no page scrolling. A floating menu switches between four views:

- **Studio**: write a prompt and watch the current batch develop.
- **Prompts**: turn a short idea into several detailed prompts, then queue the ones you pick.
- **Queue**: every job, with live progress and capacity, plus cancel and retry.
- **Gallery**: every generated image in a paginated bento layout.

## Features

- **Styles.** Ships with **Cinematic**, a prompt template built from a reference set of low-key workshop photographs.
  It frames the scene as a wide-angle environmental shot (subject full-body or knees-up in their space, not a close-up
  portrait), with a cool teal foreground over a mostly neutral, dark, uncluttered background, soft ambient fill light on
  the face and body, natural skin and deep blacks. It asks for flagship optics: a high-resolution body with a premium fast
  24–35mm prime stopped down to f/4–f/5.6, giving an ultra-sharp subject and creamy, textured bokeh in the far background.
  **Moonlight** is a realistic moonlit night in whatever place the prompt describes (a farm, a village, a view from
  inside a house...): a full moon with a soft halo in a deep blue sky, warm amber window and lantern light, foliage framing,
  a balanced HDR finish that keeps the subject bright, low-to-medium contrast, natural colour and a subtle painterly touch. With no place named it falls back to a tropical lagoon.
  **Night Paint** uses the same prompt-driven moonlit scene, rendered as a luminous painting (visible brushwork, soft
  painterly edges, glowing glazes, impasto highlights on the moon and lamps).
  **Melancholy** is modelled on a set of golden-hour village scenes: low backlit sun through hazy, dusty air with god rays,
  a warm amber and honey palette with muted sage foliage, soft lifted shadows, and quiet, nostalgic everyday moments
  often seen from behind.
  **Director's Cut** is a wide film still in a cavernous old workshop: characters facing each other across the frame,
  shafts of light from high windows through dust and haze, warm sparks and lamps against cool teal-slate shadows.
  **Solitude** is a wide, quiet moment of one person alone, in whatever setting the prompt describes (field, forest,
  beach, village, river...): a low sun flaring through leaves and mist, warm gold over sage greens with maroon and indigo cloth.
  **Landscape** is professional landscape photography of the Philippines: a cinematic but realistic sky, a smooth
  editorial HDR balance between light and shadow, and ultra-sharp detail from foreground to horizon (f/8–f/11, no bokeh).
  **Raw** sends your prompt as written, plus only the checks every style shares: the Philippines setting with Filipino
  people (unless you name another place or nationality) and anatomy (no extra limbs, heads or fingers, no distorted faces).
- **Aspect ratios.** Landscape 3:2 (1536×1024), Square 1:1 (1024×1024), Portrait 2:3 (1024×1536).
- **1–8 images per run.** Each image is its own request, so tiles finish independently. While waiting, each
  tile plays a Remotion "developing" composition (iris, scanner sweep, latent-image glow, film grain, frame counter)
  with a live timer.
- **Quote titles.** When each image finishes, `OPENAI_COMPLETION_MODEL` looks at the photo and writes a short, uplifting
  title tied to what is in it: a famous person's words (with their name) when a genuine quote fits, otherwise a Bible
  verse (with its reference). Titles show on cards and in the viewer; "New quote" / "Write a title" (re)writes one. Older
  images without a title get an "Add titles to N images" button in the Gallery.
- **Generation queue.** Every image goes through a server-side queue. `GENERATION_CONCURRENCY` images generate at once,
  and up to `GENERATION_QUEUE_SIZE` more can wait. Requests that don't fit get a clear "queue is full" message (HTTP 429).
  Waiting tiles show their place in line, and queued or running jobs can be cancelled.
- **Prompt enhancement.** The Prompts menu sends your idea to `OPENAI_COMPLETION_MODEL`, which returns 4–12 prompts as
  structured JSON. Select all, deselect all, or pick individual prompts, then choose a style, aspect ratio and number of
  images per prompt, and add them to the queue (or send one to the Studio).
- **Remotion hover physics.** Every button, tab, radio and checkbox springs up, leans toward the cursor and presses in on
  click, driven by Remotion's `spring()`.
- **Full-screen viewer.** Click any image to zoom. Scroll or click to zoom, drag to pan, `+` / `−` / `0` / `1` keys,
  `←` / `→` to move between images, download and delete from the toolbar.
- **Remotion everywhere.** Activity indicators, confirmation dialogs (the whole card is a Remotion scene), the logo,
  the empty state and the loading tiles are Remotion compositions. UI entrances, hovers, drawers, toasts and dialog transitions use Remotion's `spring()` and
  `interpolate()`.
- **Gallery menu.** Every generated image is saved to `data/` and shown in the Gallery view as a paginated bento
  (a large hero plus eight tiles per page), with frame and style filters and ←/→ paging.
- **Internal backup API and Backups panel.** Snapshot the library and every image file, then list, inspect, restore or delete
  snapshots from the **Backups** panel or over HTTP.
- **Favicons for Safari and Chrome.** Multi-size `favicon.ico`, an SVG icon, a 180px `apple-touch-icon`, and
  manifest icons.
- **No Next.js dev indicator.** `devIndicators: false`.

## Requirements

- Node.js 20.9 or newer (tested on 22)
- An OpenAI API key with access to the configured image model

## Setup

```bash
npm install
```

Create a `.env` file (see `.env.example`):

```dotenv
# APP
APP_PORT=7676

# OPENAI
OPENAI_API_KEY=sk-...
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_COMPLETION_MODEL=gpt-4.1-mini   # writes prompts in the Prompts menu

# CONFIG
GENERATION_CONCURRENCY=2   # images generated at the same time (default 2)
GENERATION_QUEUE_SIZE=20   # images that may wait in line (default 20)

# Optional
# OPENAI_IMAGE_QUALITY=high   # passed straight to the API when set
# BACKUP_TOKEN=change-me      # require a token for the backup API (otherwise it only answers on localhost)
```

## Running

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm start
```

`npm run dev` and `npm start` go through `scripts/serve.mjs`, which reads `APP_PORT` from the environment or `.env`
(spacing such as `APP_PORT = 7676` is fine) and starts Next on that port. Open `http://localhost:<APP_PORT>`.

Run this to regenerate the favicons after changing the aperture artwork in `scripts/make-icons.mjs`:

```bash
npm run icons
```

## HTTP API

| Method | Path                          | Purpose                                                         |
| ------ | ----------------------------- | --------------------------------------------------------------- |
| POST   | `/api/queue`                  | `{ items: [{ prompt, styleId, aspect }], batchId? }` or `{ prompt, styleId, aspect, count }` queues jobs (all or none; 429 when full) |
| GET    | `/api/queue`                  | `{ concurrency, queueSize, running, queued, jobs }`             |
| DELETE | `/api/queue`                  | Clear finished, failed and cancelled jobs                       |
| DELETE | `/api/queue/:id`              | Cancel a queued or running job                                  |
| POST   | `/api/enhance`                | `{ prompt, count }` returns `{ model, prompts: [{ title, prompt }] }` (JSON from the completion model) |
| POST   | `/api/generate`               | `{ prompt, styleId, aspect }` queues **one** image and waits for it (for scripts) |
| GET    | `/api/images`                 | List the library (newest first)                                 |
| GET    | `/api/images/:id`             | PNG bytes (`?download` sets `Content-Disposition`)              |
| DELETE | `/api/images/:id`             | Remove an image and its file                                    |
| POST   | `/api/images/:id/title`       | Write a new quote title for an image; returns `{ image }`       |
| POST   | `/api/images/titles`          | Write titles for every image that has none; returns `{ updated, failed, remaining }` |
| GET    | `/api/config`                 | `{ model, completionModel, keyConfigured, concurrency, queueSize }`, with no secrets |
| GET    | `/api/backup`                 | List snapshots (internal)                                       |
| POST   | `/api/backup`                 | `{ label? }` creates a snapshot (internal)                      |
| GET    | `/api/backup/:id`             | Snapshot manifest (internal)                                    |
| POST   | `/api/backup/:id/restore`     | Replace the live library with the snapshot (internal)           |
| DELETE | `/api/backup/:id`             | Delete a snapshot (internal)                                    |

**Internal access:** the backup endpoints answer only when the request's `Host` is a loopback address
(`localhost`, `127.0.0.1`, `[::1]`). If `BACKUP_TOKEN` is set, they instead require
`Authorization: Bearer <token>` or `x-backup-token: <token>`.

```bash
curl -X POST http://localhost:7676/api/backup -d '{"label":"before experiments"}'
```

```bash
curl -X POST http://localhost:7676/api/backup/<id>/restore
```

## Data layout

```
data/
  library.json            # ImageRecord[] (newest first)
  images/<id>.png
  backups/<id>/
    manifest.json         # { id, createdAt, imageCount, bytes, label? }
    library.json
    images/<id>.png
```

`data/` is git-ignored. A restore copies the snapshot's images back and replaces `library.json`. Images that are not in
the snapshot stay on disk but are no longer listed.

## Project structure

```
app/
  layout.tsx, page.tsx, globals.css    # fonts, design tokens, page shell
  favicon.ico, icon.svg, apple-icon.png, manifest.ts
  api/…                                # route handlers listed above
components/
  remotion/Stage.tsx                   # <Player> wrapper for decorative compositions
  remotion/compositions.tsx            # DevelopingFrame, ApertureSpinner, LogoMark, ConfirmGlyph, Viewfinder
  ui/                                  # Reveal, Activity, ConfirmDialog, Toasts
  studio/                              # Studio (state + views), NavIsland, Composer, FitGrid, Gallery,
                                       # PromptsView, QueueView, Tile, Lightbox, BackupDrawer, icons
  ui/HoverFX.tsx                       # global Remotion hover / press physics
lib/
  styles.ts                            # style presets (add new styles here)
  aspects.ts                           # aspect presets and count limits
  motion.ts                            # Remotion spring hooks: useReveal, usePresence, useSpringValues
  server/                              # store, OpenAI client, backup engine, internal guard
scripts/
  serve.mjs                            # runs Next on APP_PORT
  make-icons.mjs                       # favicon generator (sharp)
```

## Adding a style

Append a preset to `STYLES` in `lib/styles.ts`:

```ts
{
  id: "noir",
  name: "Noir",
  tagline: "Hard shadows, silver grain",
  swatch: ["#0b0b0b", "#5a5a5a", "#e8e8e8"],
  build: (subject) => `${subject}. Black-and-white film noir photograph, hard key light, …`,
}
```

Then add the id to the `StyleId` union. The picker, API validation and batch labels pick it up automatically.

## Licensing note

Remotion is free for individuals and small companies and needs a company license above that size.
See [remotion.dev/license](https://www.remotion.dev/license).
