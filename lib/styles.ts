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
  /** Detail pass applied after generation (lib/server/finish.ts). Defaults to "natural". */
  finish?: "crisp" | "natural" | "gentle" | "none";
}

/*
 * Shared by Cinematic, Melancholy, Director's Cut and Solitude: extra HDR light on the
 * people (background exposure left in balance), every person ultra-sharp from flagship
 * optics, and smooth, creamy bokeh. Each template keeps its own look around these lines.
 */

/** Lifts the people with a touch more HDR light while the background keeps its own balanced exposure. */
const SUBJECT_HDR =
  "HDR light on the people: every person in the frame gets an extra touch of HDR illumination — a soft, luminous lift on their faces, eyes, skin, hair, hands and clothing (as if a soft key light and a bracketed exposure for the subject were blended in), so they look luminous, read clearly and stand out as the best-lit part of the frame — the lift brightens them without softening, blurring or blooming any detail, with detail in both their highlights and shadows; the background keeps its own natural, balanced exposure and mood — not brightened to match the subject, not darkened to fake separation — so subject and background feel lit by the same world; seamless, halo-free blending around hair and edges, natural skin tones, no glowing outlines.";

/**
 * Every person ultra-sharp, as from a flagship high-resolution camera and premium prime.
 * `finish` says how that detail is rendered (Cinematic wants crisp micro-contrast; Director's Cut wants natural photographic texture).
 */
const peopleSharp = (finish = "maximum optical resolution and micro-contrast on the people, like a high-resolution capture viewed at 100%") =>
  `Sharpness: shot on a flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class, e.g. Hasselblad X2D / Sony A1 / Leica SL3, or an ARRI Alexa 65 for film stills) with a premium prime (Leica Summilux / Zeiss Otus / Sony GM class); every person in the photo is ultra-sharp — all of them placed within the plane of focus, with critical focus on their eyes and faces, individually resolved eyelashes and brows, fine skin texture and wrinkles, every strand of hair, crisp fabric weave and stitching, and fine detail on hands; ${finish}; clean, natural edge acuity with no over-sharpening, halos, smearing or AI softness; no person is soft or out of focus. The people are the sharpest thing in the image: haze, mist, glow, bloom and softness live only in the air and the background behind them, never on or in front of a person; their faces and bodies are rendered with crisp, clean detail, not a dreamy, diffused or soft-focus filter look.`;
const PEOPLE_SHARP = peopleSharp();

/**
 * Melancholy and Solitude: all the softness (haze, mist, glow, bloom, faded tones, blur) belongs to
 * the background scenery; the people and the ground they stand on stay crisp and clear.
 */
const SOFT_BACKGROUND_ONLY =
  "Where the softness goes: only the background scenery is soft — the distant trees, houses, fields, hills, sky and the hazy air between them carry the mist, glow, bloom, faded tones and creamy blur; the people, their faces, hair, hands, clothing and anything they hold, plus the ground and objects right around them, stay crisp, clear and fully detailed, with clean edges and full local contrast; no haze, mist, bloom or diffusion lies in front of or over a person, and no soft-focus, dreamy or glow filter is applied to the whole image; the transition from the sharp subject to the soft background happens with distance, the way a real lens renders it.";

/** Smooth, creamy background bokeh; `tones` describes the colour the blur melts into. */
const creamyBokeh = (tones: string) =>
  `Bokeh and depth of field: the people sit in a crisp plane of focus while the scene rolls off gradually and naturally with distance; the background melts into smooth, creamy, buttery bokeh in ${tones} — soft, round out-of-focus highlights with clean edges and even fill (no onion rings, no busy, nervous or swirly bokeh, no cat-eye distortion, no double-edged outlines); a gentle, natural transition from sharp to soft with no cut-out or fake-blur look.`;

/**
 * Shared by every style (Raw included): the scene is in the Philippines and the people are
 * Filipino, unless the prompt clearly says otherwise (another country, a named nationality or ethnicity).
 */
const PHILIPPINES =
  "Location and people: unless the description above clearly names another country, place or nationality, the scene is in the Philippines — Filipino landscapes, architecture, vegetation, vehicles, clothing and everyday objects true to the region described (for example nipa or bahay kubo houses, bahay na bato, sari-sari stores, jeepneys and tricycles, rice terraces and paddies, coconut and banana trees, carabao, bancas, capiz windows, barong and baro't saya, everyday Filipino street and home life), chosen to fit the scene rather than all at once; every person is Filipino (Filipino or Filipina) with natural Filipino features and skin tones, matching the age, gender, role and look described; nothing reads as another country by accident, and nothing becomes a stereotype or costume.";

/**
 * Shared by every style (Raw included): natural anatomy and physical plausibility, so the image
 * shows none of the tell-tale artefacts of AI generation.
 */
const NATURAL_ANATOMY =
  "Anatomy and realism: every person and animal is anatomically correct and physically plausible — exactly one head per body, two arms, two hands and two legs per person, each hand with five naturally shaped fingers and correct joints, feet with natural proportions; no extra, missing, merged, duplicated or floating limbs, hands, fingers, feet or heads; faces symmetrical and undistorted, with two well-aligned, matching eyes looking the same way, a natural nose, mouth, teeth and ears; natural body proportions and poses; people and objects interact believably (hands really grip what they hold, feet rest on the ground, bodies do not merge with furniture, tools or each other); consistent perspective, shadows and reflections; straight, continuous lines on buildings, poles and tools; no warped, melting or nonsensical objects, no garbled text, no repeated or cloned faces.";

/** Appended to each style's Avoid list. */
const AI_ARTEFACTS =
  "extra or missing limbs, extra heads, extra hands or fingers, extra feet, fused or malformed fingers, deformed hands, distorted, asymmetrical or melted faces, mismatched or misaligned eyes, warped bodies, duplicated people or faces, floating or disconnected body parts, objects merging into bodies, impossible poses, warped geometry, garbled text";

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
    PHILIPPINES,
    "Style: cinematic wide-angle environmental shot (a wide film still, not a close-up portrait), photorealistic, editorial documentary photography with natural filmic tonality.",
    "Camera and lens: shot on a flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class, e.g. Hasselblad X2D / Sony A1 / Leica SL3) with a premium fast wide-angle prime lens (24mm–35mm, e.g. 24mm f/1.4 or 35mm f/1.4, Leica Summilux / Zeiss Otus / Sony GM class) shot at f/2–f/2.8 so every person stays critically sharp; minimal wide-angle distortion with straight verticals; flawless optical quality with exceptional resolving power and micro-contrast.",
    "Composition: wide-angle environmental framing — a wide or medium-wide shot showing the subject full-body or from the knees up, occupying roughly a third to half of the frame height and placed off-centre on a rule-of-thirds line, with the space they work in clearly visible around them; eye-level or slightly low camera; one or two meaningful props or surfaces in the foreground leading into the frame; generous, calm negative space; never a tight head-and-shoulders close-up.",
    "Lighting: low-key and moody, motivated by practical sources — cool overhead fluorescent tube light bathing the subject and foreground in soft teal-tinted light, sculpting the face and forearms with gentle falloff into deep shadow; one or two small warm tungsten practicals add tiny amber accents and a subtle rim on the subject's edge, without warming the scene overall; plus soft ambient fill light (a large bounced or diffused source from the front-side) gently opening up the shadows on the subject's face, neck, arms and body so features, eyes and skin texture read clearly, while the scene keeps its low-key mood.",
    "Colour grade: cool teal cinematic grade led by the foreground — the subject's clothing, hands, tools and work surface carry a cool teal / blue-green tone from the fluorescent light; the background is mostly neutral: deep charcoal, smoky grey and soft shadow with only a faint, desaturated hint of teal, clearly less teal than the foreground; skin stays natural and believable, gently cooled, with only small warm accents in the brightest highlights from the practical lamps; muted, slightly desaturated midtones; few other colours; rich, deep neutral blacks with a faint matte lift.",
    "Tone and contrast: high micro-contrast and clarity, punchy local contrast, crisp tonal separation, moody chiaroscuro softened by the fill light and the HDR lift so the face and body are never lost in shadow, highlights held without clipping; the background keeps its low-key mood.",
    SUBJECT_HDR,
    PEOPLE_SHARP,
    creamyBokeh("muted, mostly neutral dark tones with just a trace of teal, with no distracting shapes or people behind the subject"),
    "Background: minimal and uncluttered but readable in the wide view — a simple, dark, softly blurred setting that shows the shape of the place without detail overload (a few large, calm shapes), falling away into neutral charcoal shadow and light haze; the subject and their immediate surface keep authentic gritty texture (grime, patina, worn materials).",
    "Mood: candid, serious, dignified, quietly intense; natural unposed expression; storytelling realism.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, cartoon, illustration, CGI look, plastic or airbrushed skin, flat lighting, underexposed or shadow-buried face, eyes lost in darkness, overcooked HDR halos or an over-processed look, a brightened or flattened background, deep focus with everything sharp, busy or harsh bokeh, warm orange foreground against a teal background (unbalanced split toning), sickly green or blue skin, a saturated or heavily teal background, cluttered or busy backgrounds, crowds or extra people behind the subject, sharpening halos, soft, blurry or smeared focus on any person, tight close-up or head-and-shoulders portrait framing, fisheye or heavy wide-angle distortion, motion blur on the subject, oversaturation, readable text, watermarks, logos.`,
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
 *  - a clean, noise-free, balanced HDR rendering (blended exposure bracket): the subject lifted
 *    and clearly lit, soft open shadows, gentle highlight roll-off, no deep blacks, no vignette
 *  - a light painterly touch: soft, smooth tonal transitions and gently simplified fine detail,
 *    like a photograph with the finish of a fine-art print (Night Paint is the full painting)
 */
/** The shared moonlit composition, used by Moonlight (photo) and Night Paint (painting). The prompt decides the place. */
const MOONLIGHT_SCENE = [
    "Setting and viewpoint: exactly the place and point of view described above — a farm, rice fields, a village, a garden, a forest, mountains, a shore, or a view from inside a house through a window or doorway. Keep that setting and do not replace it with a beach, sea or lagoon; add water only if it is described. Only when no place is described, use a calm Philippine lagoon (Palawan or Siargao-like) with a nipa stilt hut and bancas.",
    "Composition: a wide view of that setting at night, with a clear focal point (a warmly lit house or hut, a figure, a tree, a path or the main feature of the scene) on a rule-of-thirds line; palms, trees or foliage framing one or both sides where they fit the place; layered depth toward distant hills, trees or mountain silhouettes; plenty of sky with the moon as a secondary focal point. For an interior viewpoint, the window frame, doorway, bamboo or wooden walls and a few simple objects frame the moonlit view outside, softly lit by a warm lamp inside.",
];

const MOONLIGHT_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a realistic night landscape photograph with a subtle painterly touch — the way a skilled landscape photographer's blended long exposure of a real place under a full moon looks, finished like a fine-art print; believable and true to life, never cartoonish, fantasy-like or over-processed.",
    "Camera and lens: shot on a high-resolution full-frame camera with a sharp wide-to-normal prime (24–35mm) on a tripod at base ISO (ISO 64–100), several bracketed long exposures blended into one clean, natural HDR image; noise-free, grain-free files with smooth tonal gradations; deep depth of field with crisp detail from the foreground leaves to the distant horizon.",
    ...MOONLIGHT_SCENE,
    "Moon and sky: a full moon in the sky with a soft, natural halo, partly veiled by thin, wispy clouds that catch its light; a deep blue night sky that brightens slightly toward the moon and the horizon, as long exposures record it; soft, natural cloud shapes rather than dramatic storm clouds; a few faint stars.",
    "Water (only if the scene has any, such as a lagoon, river, pond or flooded rice paddies): calm, glassy water reflecting the sky and the moon with a natural tint, a soft silvery moon path and long golden reflections from the lamps; real water, not glowing or lit from beneath.",
    "Lighting: soft, even moonlight as the key light, gently picking out leaves, grass, crops, roofs and paths in pale silvery tones; the subject (the person, house, room or main feature) lifted out of the night with soft, clear light — moonlight plus a gentle warm glow from nearby windows, lanterns or a lamp inside — so it reads bright and detailed, never a dark silhouette; warm amber light falling off naturally onto nearby surfaces; the warm and cool light blend softly rather than clash.",
    "Colour grade: natural, realistic night colour — deep blue sky, dark natural greens in the foliage and fields, blue-teal water where there is any, warm amber lamplight; moderate, true-to-life saturation; no colour pushed or neon; neutral, believable white balance with the moonlight slightly cool and the lamps warm.",
    "Tone and contrast: balanced HDR look with low-to-medium contrast — light and shadow evenly balanced across the frame; the subject brightened and well exposed, with clear faces, clothing, walls and textures; shadows lifted and airy, showing clear detail in foliage, fields, buildings, interiors and the ground, with no pure or crushed blacks; the moon, its halo, the lamps and their reflections keep detail without blowing out; even brightness across the frame with no vignette or darkened edges; smooth, banding-free gradients in the sky; no halos around trees, roofs or the horizon.",
    "Painterly touch: a subtle fine-art finish over the photograph — soft, smooth tonal transitions, gently simplified fine detail in the distance and the sky, delicate soft edges on foliage and clouds, and a quiet luminous glow around the moon and the lamps, like a carefully hand-finished print; the subject stays crisp and real, with no visible brushstrokes, canvas texture or illustration look.",
    "Mood: serene, tranquil and peaceful; a quiet, real night in that place.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, high contrast, punchy or dramatic look, a dark or silhouetted subject, crushed or deep black shadows, heavy vignette, overcooked HDR halos or grey flat tones, over-sharpening or clarity boost, visible brushstrokes or canvas texture, oversaturated or neon colours, replacing the described setting with a beach, sea or lagoon, glowing or radioactive turquoise water, purple tones, heavy fantasy glow, daylight, sunset or golden-hour sky, harsh flash, washed-out grey tones, CGI or illustration look, plastic textures, motion blur on people or animals, film grain, digital noise, speckled or blotchy skies, cluttered crowds, readable text, watermarks, logos.`,
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
    PHILIPPINES,
    "Style: a luminous painted night landscape — a contemporary oil painting (with the soft glow of digital matte painting) of a magical moonlit scene; clearly a painting, not a photograph, yet faithful in light, colour and composition to a cinematic moonlit photo.",
    "Medium and technique: confident, visible brushstrokes and palette-knife accents; soft, painterly edges in the sky, clouds and distant foliage, tighter rendering on the focal house, figure or feature; thin luminous glazes for the moon halo, the sky and any water; thick impasto highlights on the moon, lamps and their reflections; subtle canvas texture; harmonious, deliberate simplification of detail.",
    ...MOONLIGHT_SCENE,
    "Moon and sky: a bright full moon high in the sky with a soft luminous halo, glowing through thin, wispy clouds that catch its light; deep navy-to-teal night sky with dramatic, textured dark clouds; a few faint stars.",
    "Water (only if the scene has any): glassy, calm water that glows luminous turquoise and cyan as if lit from beneath; long, shimmering golden reflections from warm lights and a silvery moon path across the surface.",
    "Lighting: cool moonlight as the key light, rim-lighting leaves, fields, roofs and paths in pale silvery green; warm amber light glowing from windows, lanterns and porches (or a lamp inside, for an interior view), spilling onto nearby surfaces; strong complementary contrast between the cool teal night and the warm golden light.",
    "Colour grade: rich teal and cyan night palette (deep navy sky, dark emerald foliage and fields, turquoise water where there is any) with warm amber, honey and orange accents from the lights; small touches of saturated red clothing on figures; rich but open shadows that still show detail, with only a gentle vignette toward the edges.",
    "Tone and contrast: balanced, glowing values — light and shadow evenly balanced across the canvas; shadows painted with rich, readable colour (deep blues, teals and greens) rather than black; luminous highlights on the moon, lamps and reflections; smooth painterly gradients in the sky.",
    "Mood: serene, tranquil, romantic and slightly magical; a quiet night in that place, peaceful solitude.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, replacing the described setting with a beach, sea or lagoon, photographic realism, camera noise or film grain, harsh black outlines, flat vector or cartoon style, anime look, muddy or dull colours, daylight, sunset or golden-hour sky, neon or purple tones, overly busy detail, cluttered crowds, readable text, signatures, watermarks, logos.`,
  ].join("\n");

/**
 * Bright, natural HDR finish shared by Melancholy and Director's Cut:
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
 *  - rural Filipino barrio: big old trees, dirt paths, nipa or tin-roofed houses
 *  - nostalgic, wistful, tender storytelling; wide-to-normal lens, subject crisp, background dissolving in haze
 */
const MELANCHOLY_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: nostalgic cinematic photograph, photorealistic, a quiet emotional film still; fine-art documentary storytelling with a gentle, slightly faded colour finish in the background; the people crisp and clear, the softness only in the background scenery behind them.",
    "Camera and lens: flagship high-resolution full-frame camera with a premium fast 35mm–50mm prime at f/2–f/2.8; every person tack-sharp while the background dissolves softly into haze and creamy bokeh; natural, lifelike perspective.",
    "Composition: wide or medium-wide environmental framing; the subject (often one or two people) small to medium in the frame, frequently seen from behind or in profile, placed off-centre; a large old tree, a dirt path, a porch or a rope swing as a framing element; leading lines such as a road or path receding into the glowing haze; generous breathing room around the figures.",
    "Lighting: low golden-hour or early-morning sun behind or beside the subject (strong backlight), glowing through thick haze; bold, dramatic volumetric god rays — strong, clearly defined shafts of warm light streaming through tree canopies, eaves and doorways and slicing through the hazy air behind and beside the people; luminous rim light on hair, shoulders and clothing; gentle bounced fill from the warm ground and walls lighting the subject's front so they stay bright, crisp and readable; long shadows stretching across the ground; a soft sun flare or bright sun disc partly hidden behind leaves or a roof.",
    "Atmosphere: dramatic, thick, sun-filled haze — dense, dusty, humid golden air in the middle distance and background, layered in visible depth planes so each row of trees, houses and hills fades further into warm glowing mist; heavy volumetric light with bright, luminous haze around the sun and in the light shafts; plenty of floating dust and pollen sparkling in the beams behind the people; strong, atmospheric aerial perspective where the far background dissolves almost entirely into golden haze; the air right around and in front of the people stays clear, so they are never veiled by it.",
    "Colour grade: warm amber, honey, peach and burnt-orange palette with soft golden highlights; foliage in muted sage and dusty blue-green; earthy browns in dirt, wood and leaves; gently lifted shadows; overall low-to-medium contrast, with the glowing, hazy, slightly faded softness held in the background scenery while the people keep clean, clear tones.",
    "Setting: unless another place is described, a rural Filipino barrio or countryside — big old acacia, mango or narra shade trees, dirt roads and yards, bahay kubo or wooden and plastered houses with nipa or tin roofs, simple porches, bamboo fences, scattered fallen leaves.",
    BRIGHT_HDR,
    SUBJECT_HDR,
    PEOPLE_SHARP,
    creamyBokeh("warm honey, amber and soft sage tones dissolving into the glowing haze"),
    SOFT_BACKGROUND_ONLY,
    "Detail: crisp, natural textures in hair, fabric, skin and the leaves and ground near the people; clean tones; softness only in the background scenery, never on a person.",
    "Mood: melancholic, nostalgic and wistful; tender, quiet, reflective; the feeling of a fading memory or a gentle goodbye; candid and unposed.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, harsh midday light, blue or cold colour casts, neon or oversaturated colours, an underexposed or silhouetted subject, a blown-out white sky or background, overcooked HDR halos or grey flat tones, a brightened or flattened background, a soft, hazy, blurry or out-of-focus person, haze or bloom over the people, an overall dreamy or soft-focus filter, busy or harsh bokeh, thin, weak or barely visible haze, a clear flat sky with no atmosphere, crushed black shadows, cluttered crowds, posed smiling-at-camera portraits, plastic or airbrushed skin, CGI or illustration look, heavy grain or noise, readable text, watermarks, logos.`,
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
 *  - bright, readable exposure: a large soft fill on the characters and lifted dark areas everywhere
 *    (corners, ceiling, floor, machines), so nothing sinks into murky shadow
 *  - photorealistic texture over punch: a soft, natural tonal curve, true-to-life skin and materials,
 *    no HDR tone-mapping crunch or boosted local contrast
 */
const DIRECTORS_CUT_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a wide cinematic frame from a modern prestige drama shot digitally — truly photorealistic, indistinguishable from a real photograph, deliberately staged like a director's frame, with the gravity and storytelling of an award-winning feature film; a clean, natural, high-end digital image, not a grainy film-stock look and not a punchy, processed or HDR-crunched look.",
    "Camera and lens: large-format digital cinema camera (ARRI Alexa 65 / Sony Venice class) at its base ISO, with a premium wide-angle cinema prime (24mm–35mm) at T2–T2.8; clean, noise-free, grain-free capture with smooth tonal gradations; wide 3:2 / anamorphic-feel framing; straight verticals, minimal distortion; every character tack-sharp, the deep background gently softened by haze and creamy bokeh.",
    "Composition: wide-angle establishing shot of a large, cavernous interior (old workshop, warehouse, mill, garage or barn); the characters shown full-body or three-quarter body, placed on the left and right thirds and facing each other in quiet conversation or shared work, with the light source or the main object between them; a sturdy worn table, bench or machine in the foreground; deep layered space receding behind them; high ceilings and tall windows visible.",
    "Lighting: natural, motivated light — soft shafts of sunlight (god rays) streaming from high windows or skylights through dust and haze, cutting diagonally or straight down through the space; warm practical accents such as sparks from a welder or grinder, bare tungsten bulbs and pendant lamps; the characters gently rim-lit and side-lit, with soft, natural modelling on their faces; the far background glows softly with window light and haze.",
    "Fill light: the characters are the brightest, clearest part of the frame after the light shafts — a large, soft fill (as if from a big bounce board or a diffused source just off camera, plus light bounced from the sunlit floor and walls) lights their faces, eyes, hands and clothing evenly from the front, so every feature and fabric reads clearly and their skin glows naturally; no part of a character falls into dark shadow. Dark areas of the scene (corners, the ceiling, under benches and machines, the floor, the far walls) are lifted with soft ambient light so their shapes, colours and materials stay visible; the space feels light-filled and airy, not dim or murky.",
    "Atmosphere: soft, smooth, even haze in the air that makes the light shafts visible as clean, continuous beams; only a few sparse, softly out-of-focus dust motes in the beams, never a speckled or noisy layer; soft round bokeh orbs from distant lamps and sparks.",
    "Colour grade: a gentle, natural teal-and-amber — soft golden and honey highlights in the light shafts, sparks and skin, against soft cool steel-blue, slate and teal tones in denim, metal and the softly lit interior; true-to-life skin tones; lifted, detailed shadows that are never black; restrained, realistic saturation.",
    "Tone and contrast: low-to-moderate contrast with a soft, natural photographic tonal curve and gentle highlight roll-off, like a real cinema camera's log footage graded with restraint; overall exposure bright and generous; the characters lifted well out of the shadows and clearly lit, the whole interior bright enough to read its depth, with the darkest areas a soft mid-dark tone full of detail rather than black; low, natural local contrast on faces, hands and fabric (no clarity or structure boost, no HDR tone-mapping, no gritty micro-contrast); smooth, clean gradients in the haze, the light shafts and the walls.",
    "Texture and realism: photorealistic, true-to-life surfaces exactly as a high-end camera records them — natural skin with real pores, fine lines and subtle variation in tone (neither airbrushed nor exaggerated); real cotton, denim and leather with soft natural sheen; wood, metal, concrete and rust with honest, quiet wear; texture is resolved by the optics, not added by sharpening or contrast, so detail reads crisp and real rather than etched or crunchy.",
    BRIGHT_HDR,
    SUBJECT_HDR,
    peopleSharp("very high optical resolution with natural micro-contrast, so detail is crisp and real rather than crunchy or etched"),
    creamyBokeh("soft slate, steel-blue and warm amber tones from the hazy depths of the space, with round orbs from distant lamps and sparks"),
    "Detail: natural, photographic detail on the characters — weathered skin with real texture and soft tonality, wrinkles, grey hair and stubble, worn work jackets and caps; tools and surfaces with real but understated wear; clean, smooth floors, walls and background surfaces rather than heavy grime or busy texture; natural, authentic expressions.",
    "Mood: contemplative, dignified, intimate and quietly epic; a meaningful moment between people; nostalgic yet grounded.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, close-up portrait framing, flat lighting without shafts or direction, characters lost in shadow, dark or underlit faces, half-shadowed faces, silhouettes, dark murky corners or underexposed areas, a dim or gloomy interior, low-key or noir look, blown-out white windows or light shafts, crushed black shadows, high contrast, punchy, dramatic or harsh look, HDR tone-mapped or crunchy look, etched or over-defined detail, strong vignette, cartoon, illustration or CGI look, plastic skin, oversaturated colours, overcooked HDR halos or grey flat tones, a soft or out-of-focus character, busy or harsh bokeh, film grain, digital noise, speckled or gritty texture, dusty or noisy haze, over-sharpening, heavy clarity or texture boost, rough or pitted skin, grimy over-textured surfaces, cluttered crowds, readable text, watermarks, logos.`,
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
 *  - a restrained background: soft, calm light about a stop below the subject, not a wall of glare
 *    (Solitude uses its own exposure line instead of BRIGHT_HDR)
 */
const SOLITUDE_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a serene, cinematic environmental photograph of quiet solitude — photorealistic fine-art documentary storytelling with a luminous, natural finish; the person crisp and clear, the softness only in the misty background scenery.",
    "Setting: the place described above, whatever it is (a field, forest, hillside, beach, village lane, garden, rooftop, shore or riverbank); keep the scene's own landscape and do not add a river or water unless it is described.",
    "Camera and lens: flagship high-resolution camera (Hasselblad X2D 100MP / Sony A1 / Leica SL3 class) with a premium 35mm prime (Leica Summilux / Zeiss Otus class) at f/2.8, focused precisely on the person's eyes; the subject critically sharp — clearly resolved eyes, lashes and brows, skin texture and fine lines, individual strands of hair, crisp fabric weave and the fine detail of their hands; the far background melting into creamy bokeh and mist.",
    "Composition: environmental shot with a single person alone, placed off-centre on a rule-of-thirds line, medium in the frame (full-body or knees-up, filling roughly a third to half of the frame height, so the face is large enough to show real detail), their face turned in three-quarter view or profile toward the light, absorbed in a quiet moment or a simple task; a natural framing element on one side (a large old tree and its overhanging branches, a doorway, a rock, tall grass or foliage); a few meaningful objects or textures from the scene in the foreground; the landscape receding into soft mist and depth behind them, with generous calm space around the figure.",
    "Lighting: low early-morning sun behind and above the subject (strong backlight) mostly hidden behind leaves or an edge in the scene, peeking through as a small, soft sunburst with only a faint lens flare; a few gentle god rays slanting through the morning mist; crisp rim light on hair, shoulders and hands.",
    "Face fill light: soft, generous ambient fill on the person's face from the front-side — as if from a large reflector or diffused bounce just out of frame, plus warm light bounced from the sunlit ground — so the face is evenly and naturally lit despite the backlight: eyes clearly visible with a small catchlight, cheeks, nose, lips and jaw fully readable, skin showing its natural texture and warm tone, no deep shadow across the face or eye sockets; the hands, neck and clothing lifted the same way; the fill looks like natural ambient light, not flash.",
    "Atmosphere: thin, soft morning mist or haze in the distance, translucent rather than glowing white, with the shapes and colours of the landscape still visible through it; a few sunlit surfaces in the scene (leaves, grass, sand, water, stone or dew) catching small, gentle highlights; a little floating dust and pollen in the light behind the person; calm aerial depth; the air right around and in front of the person is clear, never veiling them in mist.",
    "Colour grade: warm golden, honey and soft amber light over muted sage and olive greens, dusty earth browns and creamy highlights; clothing in deep maroon, rust, terracotta and soft indigo blue as quiet colour accents; gently lifted shadows; natural, slightly desaturated midtones; low-to-medium contrast, with a soft, quiet glow only in the background scenery while the person keeps clean, clear tones.",
    "Exposure: the person is the brightest, clearest part of the frame; the background is exposed about a stop lower, in soft, calm light with rich colour and visible detail — the sky, mist, sun and sunlit areas are toned down, never a bright wall of light or glare, never washed out, hazy-white or overexposed; open, detailed shadows; clean, natural tonality with no halos and no over-processed look.",
    SUBJECT_HDR,
    PEOPLE_SHARP,
    creamyBokeh("soft gold, sage and misty cream tones"),
    SOFT_BACKGROUND_ONLY,
    "Detail: crisp, natural, lived-in textures in skin, hair, hands and clothing, and in the materials right around the person catching the light; natural, unposed expression, often with eyes lowered or gazing into the distance.",
    "Mood: peaceful solitude, contemplation, patience and quiet dignity; tender, timeless and gently melancholic.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, close-up portrait framing, crowds or extra people near the subject, harsh midday light, cold or blue colour casts, oversaturated colours, an underexposed or silhouetted subject, a dark, shadowed or backlit-black face, eyes lost in shadow, a tiny distant figure with no facial detail, an overly bright, glaring, washed-out or hazy-white background, a large blinding sun or heavy lens flare, a blown-out sky, overcooked HDR halos or grey flat tones, a brightened or flattened background, a soft, hazy, blurry or out-of-focus subject, mist or bloom over the person, an overall dreamy or soft-focus filter, busy or harsh bokeh, crushed black shadows, plastic or airbrushed skin, cartoon, illustration or CGI look, heavy grain or noise, readable text, watermarks, logos.`,
  ].join("\n");

export const STYLES: StylePreset[] = [
  {
    id: "cinematic",
    finish: "crisp",
    name: "Cinematic",
    tagline: "Moody film look, razor-sharp lens",
    swatch: ["#0f1a1c", "#3f6f73", "#e39a4c"],
    build: CINEMATIC_TEMPLATE,
  },
  {
    id: "moonlight",
    finish: "gentle",
    name: "Moonlight",
    tagline: "Bright, painterly moonlit nights, any place",
    swatch: ["#0b1a26", "#1f9a96", "#f0a446"],
    build: MOONLIGHT_TEMPLATE,
  },
  {
    id: "night-paint",
    finish: "none",
    name: "Night Paint",
    tagline: "Moonlit scenes as luminous paintings",
    swatch: ["#10223a", "#2aa39b", "#f2b25a"],
    build: NIGHT_PAINT_TEMPLATE,
  },
  {
    id: "melancholy",
    finish: "natural",
    name: "Melancholy",
    tagline: "Hazy golden-hour nostalgia",
    swatch: ["#5b4a3a", "#8fa58f", "#f2b66b"],
    build: MELANCHOLY_TEMPLATE,
  },
  {
    id: "directors-cut",
    finish: "natural",
    name: "Director's Cut",
    tagline: "Wide film stills, light shafts through haze",
    swatch: ["#151b22", "#3d5a6b", "#f0a347"],
    build: DIRECTORS_CUT_TEMPLATE,
  },
  {
    id: "solitude",
    finish: "crisp",
    name: "Solitude",
    tagline: "Quiet solitary moments in morning sun",
    swatch: ["#4a4a38", "#9aa883", "#f3c374"],
    build: SOLITUDE_TEMPLATE,
  },
  {
    id: "raw",
    finish: "none",
    name: "Raw",
    tagline: "Your prompt, with the shared checks only",
    swatch: ["#1a1918", "#6b6660", "#ece6dc"],
    build: (subject) => [subject.trim(), PHILIPPINES, NATURAL_ANATOMY, `Avoid: ${AI_ARTEFACTS}.`].join("\n"),
  },
];

export const DEFAULT_STYLE: StyleId = "cinematic";

/** Unknown or retired style ids (e.g. an old "dramatic" record) fall back to Cinematic. */
export function getStyle(id: string | undefined): StylePreset {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
