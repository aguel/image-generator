// Style presets. Each style wraps the user's subject in a prompt template.
// Add a new style by appending to STYLES — the UI picks it up automatically.

export type StyleId = "cinematic" | "moonlight" | "night-paint" | "melancholy" | "directors-cut" | "solitude" | "raw";

export interface StylePreset {
  id: StyleId;
  name: string;
  tagline: string;
  /** Swatch colours shown in the style picker (shadow → mid → highlight). */
  swatch: [string, string, string];
  build: (subject: string) => string;
}

/**
 * Cinematic — reverse-engineered from the reference set (three environmental
 * portraits of mechanics in a Southeast-Asian auto workshop):
 *  - low-key, motivated practical light: overhead fluorescent / tungsten tubes
 *  - warm amber highlights against teal-cyan shadows (orange & teal grade)
 *  - deep, slightly crushed blacks with a gentle matte lift; strong local contrast
 *  - candid documentary realism, wide-angle environmental framing (not a close-up portrait)
 *  - a simple, uncluttered background so the subject dominates
 *  - teal carried by the foreground (light on the subject, clothing, surfaces); the
 *    background stays mostly neutral and dark with only a faint teal hint;
 *    natural (slightly cooled) skin and small warm highlights
 *  - an ultra-sharp subject, opened up by soft ambient fill on the face and body
 * plus high-end optics: flagship high-resolution body and a premium fast prime,
 * so the subject is critically sharp and the background melts into smooth,
 * round, artefact-free bokeh.
 */
const CINEMATIC_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: cinematic wide-angle environmental shot (a wide film still, not a close-up portrait), photorealistic, editorial documentary photography with natural filmic tonality.",
    "Camera and lens: shot on a flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class, e.g. Hasselblad X2D / Sony A1 / Leica SL3) with a premium fast wide-angle prime lens (24mm–35mm, e.g. 24mm f/1.4 or 35mm f/1.4, Leica Summilux / Zeiss Otus / Sony GM class) shot at f/1.4–f/2.8; minimal wide-angle distortion with straight verticals; flawless optical quality with exceptional resolving power and micro-contrast.",
    "Composition: wide-angle environmental framing — a wide or medium-wide shot showing the subject full-body or from the knees up, occupying roughly a third to half of the frame height and placed off-centre on a rule-of-thirds line, with the space they work in clearly visible around them; eye-level or slightly low camera; one or two meaningful props or surfaces in the foreground leading into the frame; generous, calm negative space; never a tight head-and-shoulders close-up.",
    "Lighting: low-key and moody, motivated by practical sources — cool overhead fluorescent tube light bathing the subject and foreground in soft teal-tinted light, sculpting the face and forearms with gentle falloff into deep shadow; one or two small warm tungsten practicals add tiny amber accents and a subtle rim on the subject's edge, without warming the scene overall; plus soft ambient fill light (a large bounced or diffused source from the front-side) gently opening up the shadows on the subject's face, neck, arms and body so features, eyes and skin texture read clearly, while the scene keeps its low-key mood.",
    "Colour grade: cool teal cinematic grade led by the foreground — the subject's clothing, hands, tools and work surface carry a cool teal / blue-green tone from the fluorescent light; the background is mostly neutral: deep charcoal, smoky grey and soft shadow with only a faint, desaturated hint of teal, clearly less teal than the foreground; skin stays natural and believable, gently cooled, with only small warm accents in the brightest highlights from the practical lamps; muted, slightly desaturated midtones; few other colours; rich, deep neutral blacks with a faint matte lift.",
    "Tone and contrast: high micro-contrast and clarity, punchy local contrast, crisp tonal separation, moody chiaroscuro softened by the fill light so the face and body are never lost in shadow, highlights held without clipping.",
    "Sharpness: the foreground subject is ultra-sharp — critical, pin-point focus on the eyes and face with individually resolved eyelashes and brows, visible skin pores and fine wrinkles, every strand of hair and stubble, crisp fabric weave and stitching, and fine detail on hands, nails and tools; maximum optical resolution and micro-contrast across the whole subject, like a 100MP medium-format capture viewed at 100%; clean, natural edge acuity with no over-sharpening, halos, smearing or AI softness.",
    "Bokeh and depth of field: the subject sits in a crisp plane of focus while the scene rolls off gradually and naturally with distance; the far background softens into smooth, creamy bokeh in muted, mostly neutral dark tones with just a trace of teal — a few soft round out-of-focus highlights with clean edges (no onion rings, no busy or nervous bokeh, no cat-eye distortion); no distracting shapes or people behind the subject.",
    "Background: minimal and uncluttered but readable in the wide view — a simple, dark, softly blurred setting that shows the shape of the place without detail overload (a few large, calm shapes), falling away into neutral charcoal shadow and light haze; the subject and their immediate surface keep authentic gritty texture (grime, patina, worn materials).",
    "Mood: candid, serious, dignified, quietly intense; natural unposed expression; storytelling realism.",
    "Avoid: cartoon, illustration, CGI look, plastic or airbrushed skin, flat lighting, underexposed or shadow-buried face, eyes lost in darkness, HDR or over-processed look, deep focus with everything sharp, busy or harsh bokeh, warm orange foreground against a teal background (unbalanced split toning), sickly green or blue skin, a saturated or heavily teal background, cluttered or busy backgrounds, crowds or extra people behind the subject, sharpening halos, soft, blurry or smeared focus on the subject, tight close-up or head-and-shoulders portrait framing, fisheye or heavy wide-angle distortion, motion blur on the subject, oversaturation, readable text, watermarks, logos.",
  ].join("\n");

/**
 * Moonlight — reverse-engineered from a reference set of six tropical night
 * landscapes (lagoon, stilt huts, outrigger boats, palms under a full moon), tuned for realism.
 * The look is kept; the place is not: the setting and viewpoint come from the prompt
 * (farm, village, forest, mountain, inside a house looking out...). The lagoon is only the
 * fallback when the prompt names no place.
 *  - a full moon with a soft, natural halo through thin clouds in a deep blue night sky
 *  - calm water with a true-to-life teal tint near the shore and a silvery moon path
 *  - warm amber light from huts/lanterns with long golden reflections on the water
 *  - cool moonlight vs. warm lamplight, but low-to-medium contrast and natural saturation
 *  - lush foliage and palms framing the scene, distant mountain silhouettes
 *  - a clean, noise-free, natural (not "HDR") long-exposure rendering: soft open shadows,
 *    gentle highlight roll-off, no deep blacks, no vignette, crisp detail front to back
 */
/** The shared moonlit composition, used by Moonlight (photo) and Night Paint (painting). The prompt decides the place. */
const MOONLIGHT_SCENE = [
    "Setting and viewpoint: exactly the place and point of view described above — a farm, rice fields, a village, a garden, a forest, mountains, a shore, or a view from inside a house through a window or doorway. Keep that setting and do not replace it with a beach, sea or lagoon; add water only if it is described. Only when no place is described, use a calm tropical lagoon with a thatched stilt hut.",
    "Composition: a wide view of that setting at night, with a clear focal point (a warmly lit house or hut, a figure, a tree, a path or the main feature of the scene) on a rule-of-thirds line; palms, trees or foliage framing one or both sides where they fit the place; layered depth toward distant hills, trees or mountain silhouettes; plenty of sky with the moon as a secondary focal point. For an interior viewpoint, the window frame, doorway, bamboo or wooden walls and a few simple objects frame the moonlit view outside, softly lit by a warm lamp inside.",
];

const MOONLIGHT_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: a realistic night landscape photograph, true to life — the way a skilled landscape photographer's long exposure of a real place under a full moon looks; natural and believable, never stylised, fantasy-like or over-processed.",
    "Camera and lens: shot on a high-resolution full-frame camera with a sharp wide-to-normal prime (24–35mm) on a tripod at base ISO (ISO 64–100), a clean long exposure of several seconds; noise-free, grain-free files with smooth tonal gradations; deep depth of field with crisp detail from the foreground leaves to the distant horizon.",
    ...MOONLIGHT_SCENE,
    "Moon and sky: a full moon in the sky with a soft, natural halo, partly veiled by thin, wispy clouds that catch its light; a deep blue night sky that brightens slightly toward the moon and the horizon, as long exposures record it; soft, natural cloud shapes rather than dramatic storm clouds; a few faint stars.",
    "Water (only if the scene has any, such as a lagoon, river, pond or flooded rice paddies): calm, glassy water reflecting the sky and the moon with a natural tint, a soft silvery moon path and long golden reflections from the lamps; real water, not glowing or lit from beneath.",
    "Lighting: soft, even moonlight as the key light, gently picking out leaves, grass, crops, roofs and paths in pale silvery tones; warm amber light from windows, lanterns and porches (or from a lamp inside, for an interior view), falling off naturally onto nearby surfaces; the warm and cool light blend softly rather than clash.",
    "Colour grade: natural, realistic night colour — deep blue sky, dark natural greens in the foliage and fields, blue-teal water where there is any, warm amber lamplight; moderate, true-to-life saturation; no colour pushed or neon; neutral, believable white balance with the moonlight slightly cool and the lamps warm.",
    "Tone and contrast: low-to-medium contrast with a soft, gentle tonal curve — shadows open and airy, showing clear detail in foliage, fields, buildings, interiors and the ground, with no pure or crushed blacks; highlights on the moon, lamps and reflections roll off smoothly and keep detail; even brightness across the frame with no vignette or darkened edges; smooth, banding-free gradients in the sky; natural clarity without extra micro-contrast or sharpening.",
    "Mood: serene, tranquil and peaceful; a quiet, real night in that place.",
    "Avoid: high contrast, punchy or dramatic look, crushed or deep black shadows, heavy vignette, HDR look or halos, over-sharpening or clarity boost, oversaturated or neon colours, replacing the described setting with a beach, sea or lagoon, glowing or radioactive turquoise water, purple tones, fantasy or dreamy glow, daylight, sunset or golden-hour sky, harsh flash, washed-out grey tones, CGI or illustration look, plastic textures, motion blur on people or animals, film grain, digital noise, speckled or blotchy skies, cluttered crowds, readable text, watermarks, logos.",
  ].join("\n");

/**
 * Night Paint — the Moonlight composition (same prompt-driven setting) with its own glowing,
 * magical light (luminous water where there is any, amber-lit windows, a rich teal/amber palette)
 * rendered as a painting:
 * visible confident brushwork, soft painterly edges, luminous glazes, canvas texture.
 */
const NIGHT_PAINT_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: a luminous painted night landscape — a contemporary oil painting (with the soft glow of digital matte painting) of a magical moonlit scene; clearly a painting, not a photograph, yet faithful in light, colour and composition to a cinematic moonlit photo.",
    "Medium and technique: confident, visible brushstrokes and palette-knife accents; soft, painterly edges in the sky, clouds and distant foliage, tighter rendering on the focal house, figure or feature; thin luminous glazes for the moon halo, the sky and any water; thick impasto highlights on the moon, lamps and their reflections; subtle canvas texture; harmonious, deliberate simplification of detail.",
    ...MOONLIGHT_SCENE,
    "Moon and sky: a bright full moon high in the sky with a soft luminous halo, glowing through thin, wispy clouds that catch its light; deep navy-to-teal night sky with dramatic, textured dark clouds; a few faint stars.",
    "Water (only if the scene has any): glassy, calm water that glows luminous turquoise and cyan as if lit from beneath; long, shimmering golden reflections from warm lights and a silvery moon path across the surface.",
    "Lighting: cool moonlight as the key light, rim-lighting leaves, fields, roofs and paths in pale silvery green; warm amber light glowing from windows, lanterns and porches (or a lamp inside, for an interior view), spilling onto nearby surfaces; strong complementary contrast between the cool teal night and the warm golden light.",
    "Colour grade: rich teal and cyan night palette (deep navy sky, dark emerald foliage and fields, turquoise water where there is any) with warm amber, honey and orange accents from the lights; small touches of saturated red clothing on figures; rich but open shadows that still show detail, with only a gentle vignette toward the edges.",
    "Tone and contrast: balanced, glowing values — light and shadow evenly balanced across the canvas; shadows painted with rich, readable colour (deep blues, teals and greens) rather than black; luminous highlights on the moon, lamps and reflections; smooth painterly gradients in the sky.",
    "Mood: serene, tranquil, romantic and slightly magical; a quiet night in that place, peaceful solitude.",
    "Avoid: replacing the described setting with a beach, sea or lagoon, photographic realism, camera noise or film grain, harsh black outlines, flat vector or cartoon style, anime look, muddy or dull colours, daylight, sunset or golden-hour sky, neon or purple tones, overly busy detail, cluttered crowds, readable text, signatures, watermarks, logos.",
  ].join("\n");

/**
 * Bright, natural HDR finish shared by Melancholy, Director's Cut and Solitude:
 * the backlit subject is lifted to a clear, well-exposed level and the bright
 * background (sun, sky, haze, windows) keeps its detail instead of clipping,
 * like a blended exposure bracket, without the grey, haloed "HDR" look.
 */
const BRIGHT_HDR =
  "HDR exposure: a bright, natural HDR finish, as if several bracketed exposures were blended — the subject is lifted and well exposed, with a clear, luminous face, skin, hands and clothing even against the backlight, never a dark silhouette; the bright background (sun, sky, haze, windows and light shafts) stays airy and luminous yet keeps its detail and colour instead of blowing out to white; open, detailed shadows; even, light-filled exposure across the frame; clean, natural tonality with no halos, no grey or flat midtones and no over-processed look.";

/**
 * Melancholy — reverse-engineered from a reference set of four golden-hour
 * village scenes (children on a tree swing, two children walking hand in hand,
 * a woman sweeping leaves before a house, two schoolboys on a dirt road):
 *  - low sun behind or beside the subject (backlight), early morning or golden hour
 *  - hazy, dusty air with volumetric god rays through trees, eaves and doorways
 *  - warm amber / honey / peach palette with muted sage and blue-green foliage, lifted soft shadows
 *  - quiet everyday moments, subjects often seen from behind or in profile, small-to-medium in frame
 *  - rural Southeast-Asian village: big old trees, dirt paths, thatched or tin-roofed houses
 *  - nostalgic, wistful, tender storytelling; wide-to-normal lens, subject crisp, background dissolving in haze
 */
const MELANCHOLY_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: nostalgic cinematic photograph, photorealistic, a quiet emotional film still; fine-art documentary storytelling with a soft, dreamy, slightly faded finish.",
    "Camera and lens: full-frame camera with a 35mm–50mm prime at f/1.8–f/2.8; the subject crisp and in focus while the background dissolves softly into haze and gentle bokeh; natural, lifelike perspective.",
    "Composition: wide or medium-wide environmental framing; the subject (often one or two people) small to medium in the frame, frequently seen from behind or in profile, placed off-centre; a large old tree, a dirt path, a porch or a rope swing as a framing element; leading lines such as a road or path receding into the glowing haze; generous breathing room around the figures.",
    "Lighting: low golden-hour or early-morning sun behind or beside the subject (strong backlight), glowing through the haze; warm volumetric god rays streaming through tree canopies, eaves and doorways; luminous rim light on hair, shoulders and clothing; soft bounced fill from the warm ground and walls lighting the subject's front so they stay bright and readable; long soft shadows stretching across the ground; a soft sun flare or bright sun disc partly hidden behind leaves or a roof.",
    "Atmosphere: hazy, dusty, humid air; floating dust and pollen catching the light; kicked-up dust near the ground; distant elements fading into warm mist, giving strong aerial depth.",
    "Colour grade: warm amber, honey, peach and burnt-orange palette with soft golden highlights; foliage in muted sage and dusty blue-green; earthy browns in dirt, wood and leaves; gently lifted, slightly faded shadows; overall low-to-medium contrast with a glowing, hazy softness.",
    "Setting: a rural Southeast-Asian village or countryside — big old shade trees, dirt roads and yards, wooden or plastered houses with thatched or tin roofs, simple porches, scattered fallen leaves.",
    BRIGHT_HDR,
    "Detail: the subject sharp with natural textures in hair, fabric, skin and leaves; clean, smooth tones; gentle softness in the far background only.",
    "Mood: melancholic, nostalgic and wistful; tender, quiet, reflective; the feeling of a fading memory or a gentle goodbye; candid and unposed.",
    "Avoid: harsh midday light, blue or cold colour casts, neon or oversaturated colours, an underexposed or silhouetted subject, a blown-out white sky or background, overcooked HDR halos or grey flat tones, crushed black shadows, cluttered crowds, posed smiling-at-camera portraits, plastic or airbrushed skin, CGI or illustration look, heavy grain or noise, readable text, watermarks, logos.",
  ].join("\n");

/**
 * Director's Cut — reverse-engineered from a reference set of wide film stills
 * in a cavernous old workshop (two elderly craftsmen in conversation):
 *  - wide-angle establishing composition, characters full or three-quarter body, facing each other across the frame
 *  - shafts of volumetric light from high windows/skylights cutting through dust and haze, often between the characters
 *  - warm golden highlights (window light, sparks, bare bulbs) against cool blue-teal and slate shadows
 *  - cinematic contrast with a bright HDR finish (BRIGHT_HDR): characters lifted out of the shadows,
 *    bright windows and haze kept detailed; glowing dust motes and soft bokeh orbs in the depth
 *  - tack-sharp characters with weathered faces and worn textures; the far background softened by haze
 *  - a clean, noise-free digital finish: smooth haze and skin, natural (not boosted) texture, no film grain
 */
const DIRECTORS_CUT_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: a wide cinematic frame from a modern prestige drama shot digitally — photorealistic, deliberately staged like a director's frame, with the gravity and storytelling of an award-winning feature film; a clean, polished, high-end digital image, not a grainy film-stock look.",
    "Camera and lens: large-format digital cinema camera (ARRI Alexa 65 / Sony Venice class) at its base ISO, with a premium wide-angle cinema prime (24mm–35mm) at T2–T2.8; clean, noise-free, grain-free capture with smooth tonal gradations; wide 3:2 / anamorphic-feel framing; straight verticals, minimal distortion; the characters tack-sharp, the deep background gently softened by haze.",
    "Composition: wide-angle establishing shot of a large, cavernous interior (old workshop, warehouse, mill, garage or barn); the characters shown full-body or three-quarter body, placed on the left and right thirds and facing each other in quiet conversation or shared work, with the light source or the main object between them; a sturdy worn table, bench or machine in the foreground; deep layered space receding behind them; high ceilings and tall windows visible.",
    "Lighting: dramatic motivated light — strong shafts of sunlight (god rays) streaming from high windows or skylights through dust and haze, cutting diagonally or straight down through the space; warm practical accents such as sparks from a welder or grinder, bare tungsten bulbs and pendant lamps; the characters rim-lit and side-lit with sculpted faces, plus soft bounced fill from the sunlit floor and walls so their faces, hands and clothing stay bright and detailed; the far background glows bright with window light and haze.",
    "Atmosphere: soft, smooth, even haze in the air that makes the light shafts visible as clean, continuous beams; only a few sparse, softly out-of-focus dust motes in the beams, never a speckled or noisy layer; soft round bokeh orbs from distant lamps and sparks.",
    "Colour grade: cinematic teal-and-amber — golden, honey and orange highlights in the light shafts, sparks and skin, against cool steel-blue, slate and teal shadows in denim, metal and the dim interior; lifted, detailed blacks; restrained overall saturation.",
    "Tone and contrast: cinematic contrast with luminous highlights held without clipping; the characters lifted out of the shadows and clearly lit, the interior bright enough to read its depth, shadows open and detailed rather than black; gentle, natural local contrast on faces, hands and fabric (no clarity boost, no gritty micro-contrast); smooth, clean gradients in the haze, the light shafts and the walls.",
    BRIGHT_HDR,
    "Detail: crisp, natural detail on the characters — weathered skin with soft, smooth tonality, wrinkles, grey hair and stubble, worn work jackets and caps; tools and surfaces with real but understated wear; clean, smooth floors, walls and background surfaces rather than heavy grime or busy texture; natural, authentic expressions.",
    "Mood: contemplative, dignified, intimate and quietly epic; a meaningful moment between people; nostalgic yet grounded.",
    "Avoid: close-up portrait framing, flat or even lighting, characters lost in shadow or silhouetted, blown-out white windows or light shafts, crushed black shadows, cartoon, illustration or CGI look, plastic skin, oversaturated colours, overcooked HDR halos or grey flat tones, film grain, digital noise, speckled or gritty texture, dusty or noisy haze, over-sharpening, heavy clarity or texture boost, rough or pitted skin, grimy over-textured surfaces, cluttered crowds, readable text, watermarks, logos.",
  ].join("\n");

/**
 * Solitude — reverse-engineered from a reference set of an elderly woman weaving
 * alone on a riverbank at sunrise. The look is kept; the place is not: the setting
 * comes from the prompt (field, forest, mountain, beach, village, rooftop, river...).
 *  - a single person alone, absorbed in a quiet moment or simple task, small-to-medium in a wide frame
 *  - a natural framing element (tree, branches, doorway, rock, tall grass) and real depth behind them
 *  - low sun backlighting: sunburst through leaves or past an edge, soft flare and god rays through morning mist
 *  - glowing rim light on hair, shoulders and hands; sparkling highlights on whatever catches the sun
 *  - warm golden / honey light over soft sage greens and earth browns; maroon, rust and indigo cloth
 *  - creamy background bokeh, sharp subject, serene and contemplative
 */
const SOLITUDE_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: a serene, cinematic environmental photograph of quiet solitude — photorealistic fine-art documentary storytelling with a soft, luminous, painterly-real finish.",
    "Setting: the place described above, whatever it is (a field, forest, hillside, beach, village lane, garden, rooftop, shore or riverbank); keep the scene's own landscape and do not add a river or water unless it is described.",
    "Camera and lens: full-frame camera with a wide-to-normal prime (28mm–35mm) at f/2–f/2.8; wide environmental framing; the subject tack-sharp with fine detail in hair, skin, hands and clothing; the far background melting into creamy bokeh and mist.",
    "Composition: wide-angle shot with a single person alone, placed off-centre on a rule-of-thirds line, small to medium in the frame and absorbed in a quiet moment or a simple task; a natural framing element on one side (a large old tree and its overhanging branches, a doorway, a rock, tall grass or foliage); a few meaningful objects or textures from the scene in the foreground; the landscape receding into soft mist and depth behind them, with generous calm space around the figure.",
    "Lighting: low early-morning sun behind and above the subject (strong backlight) breaking through leaves or past an edge in the scene as a soft sunburst with gentle lens flare; hazy god rays slanting through morning mist; glowing rim light on hair, shoulders and hands; soft bounced fill from the bright ground and surroundings so the face, hands and clothing stay bright, clear and calm.",
    "Atmosphere: soft morning mist or haze in the distance; sunlit surfaces in the scene (leaves, grass, sand, water, stone or dew) catching the light as gentle sparkling highlights; floating dust and pollen in the light; airy aerial depth.",
    "Colour grade: warm golden, honey and soft amber light over muted sage and olive greens, dusty earth browns and creamy highlights; clothing in deep maroon, rust, terracotta and soft indigo blue as quiet colour accents; gently lifted, soft shadows; natural, slightly desaturated midtones; low-to-medium contrast with a luminous glow.",
    BRIGHT_HDR,
    "Detail: natural, lived-in textures in skin, hair, hands and clothing, and in the materials of the scene catching the light; natural, unposed expression, often with eyes lowered or gazing into the distance.",
    "Mood: peaceful solitude, contemplation, patience and quiet dignity; tender, timeless and gently melancholic.",
    "Avoid: close-up portrait framing, crowds or extra people near the subject, harsh midday light, cold or blue colour casts, oversaturated colours, an underexposed or silhouetted subject, a blown-out white sky or background, overcooked HDR halos or grey flat tones, crushed black shadows, plastic or airbrushed skin, cartoon, illustration or CGI look, heavy grain or noise, readable text, watermarks, logos.",
  ].join("\n");

export const STYLES: StylePreset[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    tagline: "Moody film look, razor-sharp lens",
    swatch: ["#0f1a1c", "#3f6f73", "#e39a4c"],
    build: CINEMATIC_TEMPLATE,
  },
  {
    id: "moonlight",
    name: "Moonlight",
    tagline: "Realistic moonlit nights, any place",
    swatch: ["#0b1a26", "#1f9a96", "#f0a446"],
    build: MOONLIGHT_TEMPLATE,
  },
  {
    id: "night-paint",
    name: "Night Paint",
    tagline: "Moonlit scenes as luminous paintings",
    swatch: ["#10223a", "#2aa39b", "#f2b25a"],
    build: NIGHT_PAINT_TEMPLATE,
  },
  {
    id: "melancholy",
    name: "Melancholy",
    tagline: "Hazy golden-hour nostalgia",
    swatch: ["#5b4a3a", "#8fa58f", "#f2b66b"],
    build: MELANCHOLY_TEMPLATE,
  },
  {
    id: "directors-cut",
    name: "Director's Cut",
    tagline: "Wide film stills, light shafts through haze",
    swatch: ["#151b22", "#3d5a6b", "#f0a347"],
    build: DIRECTORS_CUT_TEMPLATE,
  },
  {
    id: "solitude",
    name: "Solitude",
    tagline: "Quiet solitary moments in morning sun",
    swatch: ["#4a4a38", "#9aa883", "#f3c374"],
    build: SOLITUDE_TEMPLATE,
  },
  {
    id: "raw",
    name: "Raw",
    tagline: "Prompt as written",
    swatch: ["#1a1918", "#6b6660", "#ece6dc"],
    build: (subject) => subject.trim(),
  },
];

export const DEFAULT_STYLE: StyleId = "cinematic";

/** Unknown or retired style ids (e.g. an old "dramatic" record) fall back to Cinematic. */
export function getStyle(id: string | undefined): StylePreset {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
