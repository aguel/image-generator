// Style presets. Each style wraps the user's subject in a prompt template.
// Add a new style by appending to STYLES — the UI picks it up automatically.

import type { AspectId } from "./aspects";

export type StyleId = "cinematic" | "moonlight" | "night-paint" | "melancholy" | "directors-cut" | "solitude" | "landscape" | "portrait" | "heritage" | "raw";

export interface StylePreset {
  id: StyleId;
  name: string;
  tagline: string;
  /** Swatch colours shown in the style picker (shadow → mid → highlight). */
  swatch: [string, string, string];
  build: (subject: string) => string;
  /** Detail pass applied after generation (lib/server/finish.ts). Defaults to "natural". */
  finish?: "ultra" | "crisp" | "natural" | "gentle" | "none";
  /** Frame the pickers switch to when this style is chosen. It can still be changed afterwards. */
  aspect?: AspectId;
}

/*
 * Shared by Cinematic, Melancholy, Director's Cut and Solitude: extra HDR light on the
 * people (background exposure left in balance unless a template says otherwise), every person ultra-sharp from flagship
 * optics, and smooth, creamy bokeh. Each template keeps its own look around these lines.
 */

/**
 * Lifts the people with a touch more HDR light. `background` says how the rest of the frame is exposed
 * (by default it keeps its own balanced exposure; Director's Cut wants it darker).
 */
const subjectHdr = (background = "the background keeps its own natural, balanced exposure and mood — not brightened to match the subject, not darkened to fake separation — so subject and background feel lit by the same world") =>
  `HDR light on the people: every person in the frame gets an extra touch of HDR illumination — a soft, luminous lift on their faces, eyes, skin, hair, hands and clothing (as if a soft key light and a bracketed exposure for the subject were blended in), so they look luminous, read clearly and stand out as the best-lit part of the frame — the lift brightens them without softening, blurring or blooming any detail, with detail in both their highlights and shadows; ${background}; seamless, halo-free blending around hair and edges, natural skin tones, no glowing outlines.`;
const SUBJECT_HDR = subjectHdr();

/**
 * Every person (and what they hold) ultra-sharp and photorealistic, as from a flagship camera with
 * a premium prime stopped down to its sharpest aperture. Used by every style except Night Paint.
 * `finish` says how that detail is rendered (Cinematic wants crisp micro-contrast; Director's Cut wants natural texture).
 */
const peopleSharp = (finish = "maximum optical resolution and micro-contrast on the people, like a high-resolution capture viewed at 100%") =>
  `Sharpness: photorealistic detail as captured by a flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class, e.g. Hasselblad X2D / Phase One / Sony A1 / Leica SL3, or an ARRI Alexa 65 for film stills) at base ISO with a premium prime (Leica Summilux / Zeiss Otus / Sony GM class) stopped down to its sharpest aperture, around f/4–f/5.6, with focus placed precisely on the people; every person and everything they wear, hold or touch is ultra-sharp — all of them within the plane of focus, critical focus on their eyes and faces, individually resolved eyelashes and brows, real skin pores, fine lines and natural skin texture, every strand of hair, crisp fabric weave, stitching and buttons, the fine detail of hands, nails and jewellery, and the grain, wear and edges of the tools, cups, baskets or objects in their hands; ${finish}; true-to-life, photographic rendering — real optical sharpness, not an illustration, CGI or AI-smoothed look; clean, natural edge acuity with no over-sharpening, halos, smearing or waxy skin; no person is soft or out of focus. The people are the sharpest thing in the image: haze, mist, glow, bloom and softness live only in the air and the background behind them, never on or in front of a person; their faces and bodies are rendered with crisp, clean detail, not a dreamy, diffused or soft-focus filter look.`;
const PEOPLE_SHARP = peopleSharp();

/**
 * Melancholy and Solitude: all the softness (haze, mist, glow, bloom, faded tones, blur) belongs to
 * the background scenery; the people and the ground they stand on stay crisp and clear.
 */
const SOFT_BACKGROUND_ONLY =
  "Where the softness goes: only the background scenery is soft — the distant trees, houses, fields, hills, sky and the hazy air between them carry the mist, glow, bloom, faded tones and creamy blur; the people, their faces, hair, hands, clothing and anything they hold, plus the ground and objects right around them, stay crisp, clear and fully detailed, with clean edges and full local contrast; no haze, mist, bloom or diffusion lies in front of or over a person, and no soft-focus, dreamy or glow filter is applied to the whole image; the transition from the sharp subject to the soft background happens with distance, the way a real lens renders it.";

/**
 * Ultra-realistic background bokeh: creamy, with real optical texture; `tones` describes the colour the blur melts into.
 * Pairs with `peopleSharp`: the background sits far behind the people so it still melts away at f/4–f/5.6.
 */
const creamyBokeh = (tones: string) =>
  `Bokeh and depth of field: the people sit in a crisp, deep-enough plane of focus while the background lies well behind them, so even at f/4–f/5.6 it falls away gradually and naturally with distance into ultra-realistic, creamy optical bokeh in ${tones}; the blur keeps real lens texture rather than a flat digital smear — soft, recognisable shapes of leaves, branches, buildings and lights, subtle tonal variation and gentle gradation within the blur, round and slightly organic out-of-focus highlights with soft, clean edges and a faint natural texture inside them, very gentle cat's-eye shapes only toward the frame edges, the way a premium prime renders a real scene; no onion rings, no busy, nervous or swirly bokeh, no harsh double-edged outlines, no flat Gaussian or phone portrait-mode blur, no cut-out edges around hair or shoulders; a seamless, physically correct transition from the sharp people to the soft background.`;

/**
 * Shared by every style (Raw included): the scene is in the Philippines and the people are
 * Filipino, unless the prompt clearly says otherwise (another country, a named nationality or ethnicity).
 */
const PHILIPPINES =
  "Location and people: unless the description above clearly names another country, place or nationality, the scene is in the Philippines — Filipino landscapes, architecture, vegetation, vehicles, clothing and everyday objects true to the region described (for example nipa or bahay kubo houses, bahay na bato, sari-sari stores, jeepneys and tricycles, rice terraces and paddies, coconut and banana trees, carabao, bancas, capiz windows, barong and baro't saya, everyday Filipino street and home life), chosen to fit the scene rather than all at once; every person is Filipino (Filipino or Filipina) with natural Filipino features and skin tones, matching the age, gender, role and look described; nothing reads as another country by accident, and nothing becomes a stereotype or costume. Headwear: Filipino farmers, fishers and outdoor workers wear Filipino hats — a wide-brimmed woven buri, anahaw or straw farmer's hat with a rounded, dome-shaped crown (a salakot with a rounded top), a woven buntal straw hat, a faded cap or bucket hat, or a towel (bimpo) draped over the head and neck under a cap; never the steep, pointed conical Vietnamese hat (nón lá) or other East Asian conical hats; many people wear no hat at all.";

/** Appended to every style's Avoid list: things that make a Philippine scene read as another country. */
const NOT_PHILIPPINES =
  "pointed conical Vietnamese nón lá hats or any steep cone-shaped Asian hat, Vietnamese áo bà ba or Chinese or Japanese clothing on Filipino people (unless described)";

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
    "Camera and lens: shot on a flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class, e.g. Hasselblad X2D / Sony A1 / Leica SL3) with a premium fast wide-angle prime lens (24mm–35mm, e.g. 24mm or 35mm Leica Summilux / Zeiss Otus / Sony GM class) stopped down to f/4–f/5.6 for maximum detail on every person, with the background far enough behind them to melt into creamy bokeh; minimal wide-angle distortion with straight verticals; flawless optical quality with exceptional resolving power and micro-contrast.",
    "Composition: wide-angle environmental framing — a wide or medium-wide shot showing the subject full-body or from the knees up, occupying roughly a third to half of the frame height and placed off-centre on a rule-of-thirds line, with the space they work in clearly visible around them; eye-level or slightly low camera; one or two meaningful props or surfaces in the foreground leading into the frame; generous, calm negative space; never a tight head-and-shoulders close-up.",
    "Lighting: a moody, low-key scene around a well-lit subject, motivated by practical sources — cool overhead fluorescent tube light bathing the subject and foreground in soft teal-tinted light, gently sculpting the face and forearms; one or two small warm tungsten practicals add tiny amber accents and a subtle rim on the subject's edge, without warming the scene overall; the low-key mood lives in the background and the edges of the frame, not on the subject.",
    "Fill and ambient light on the subject: generous, soft ambient fill on every person — a large diffused source (like a big bounce board or a softbox just out of frame, at about 30–45 degrees from the front) plus soft light bouncing off nearby walls, floor and work surfaces — evenly lighting the face, eyes, neck, arms, hands and clothing; shadows on the subject stay gentle and translucent, about one stop below the key, never black; the eyes are clearly visible with a small natural catchlight, the eye sockets, the under-chin and the shadow side of the face fully readable with skin texture and colour; the fill is neutral to slightly cool so skin stays natural, and it reads as believable ambient light in the room, not flash.",
    "Colour grade: cool teal cinematic grade led by the foreground — the subject's clothing, hands, tools and work surface carry a cool teal / blue-green tone from the fluorescent light; the background is mostly neutral: deep charcoal, smoky grey and soft shadow with only a faint, desaturated hint of teal, clearly less teal than the foreground; skin stays natural and believable, gently cooled, with only small warm accents in the brightest highlights from the practical lamps; muted, slightly desaturated midtones; few other colours; rich, deep neutral blacks with a faint matte lift.",
    "Tone and contrast: high micro-contrast and clarity, crisp tonal separation; the subject bright, open and evenly filled, with soft, low-ratio lighting on the face and body (gentle shading, never chiaroscuro on the person), highlights held without clipping; the moody contrast and deep shadow belong to the background, which keeps its low-key mood.",
    SUBJECT_HDR,
    PEOPLE_SHARP,
    creamyBokeh("muted, mostly neutral dark tones with just a trace of teal, with no distracting shapes or people behind the subject"),
    "Background: minimal and uncluttered but readable in the wide view — a simple, dark, softly blurred setting that shows the shape of the place without detail overload (a few large, calm shapes), falling away into neutral charcoal shadow and light haze; the subject and their immediate surface keep authentic gritty texture (grime, patina, worn materials).",
    "Mood: candid, serious, dignified, quietly intense; natural unposed expression; storytelling realism.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, cartoon, illustration, CGI look, plastic or airbrushed skin, flat lighting, underexposed or shadow-buried face, eyes lost in darkness, dark eye sockets, half the face in deep shadow, hard harsh shadows on the subject, a dim or underlit subject, high-ratio chiaroscuro on the person, overcooked HDR halos or an over-processed look, a brightened or flattened background, deep focus with everything sharp, busy, harsh, flat or fake-looking bokeh, warm orange foreground against a teal background (unbalanced split toning), sickly green or blue skin, a saturated or heavily teal background, cluttered or busy backgrounds, crowds or extra people behind the subject, sharpening halos, soft, blurry or smeared focus on any person, tight close-up or head-and-shoulders portrait framing, fisheye or heavy wide-angle distortion, motion blur on the subject, oversaturation, readable text, watermarks, logos.`,
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
    "Camera and lens: shot on a high-resolution full-frame camera with a sharp wide-to-normal prime (24–35mm) on a tripod at base ISO (ISO 64–100), several bracketed long exposures blended into one clean, natural HDR image; noise-free, grain-free files with smooth tonal gradations; the focal subject, any people and the nearby scene crisp and detailed, with the distant background softening gently into creamy, textured bokeh.",
    ...MOONLIGHT_SCENE,
    "Moon and sky: a full moon in the sky with a soft, natural halo, partly veiled by thin, wispy clouds that catch its light; a deep blue night sky that brightens slightly toward the moon and the horizon, as long exposures record it; soft, natural cloud shapes rather than dramatic storm clouds; a few faint stars.",
    "Water (only if the scene has any, such as a lagoon, river, pond or flooded rice paddies): calm, glassy water reflecting the sky and the moon with a natural tint, a soft silvery moon path and long golden reflections from the lamps; real water, not glowing or lit from beneath.",
    "Lighting: soft, even moonlight as the key light, gently picking out leaves, grass, crops, roofs and paths in pale silvery tones; the subject (the person, house, room or main feature) lifted out of the night with soft, clear light — moonlight plus a gentle warm glow from nearby windows, lanterns or a lamp inside — so it reads bright and detailed, never a dark silhouette; warm amber light falling off naturally onto nearby surfaces; the warm and cool light blend softly rather than clash.",
    "Colour grade: natural, realistic night colour — deep blue sky, dark natural greens in the foliage and fields, blue-teal water where there is any, warm amber lamplight; moderate, true-to-life saturation; no colour pushed or neon; neutral, believable white balance with the moonlight slightly cool and the lamps warm.",
    "Tone and contrast: balanced HDR look with low-to-medium contrast — light and shadow evenly balanced across the frame; the subject brightened and well exposed, with clear faces, clothing, walls and textures; shadows lifted and airy, showing clear detail in foliage, fields, buildings, interiors and the ground, with no pure or crushed blacks; the moon, its halo, the lamps and their reflections keep detail without blowing out; even brightness across the frame with no vignette or darkened edges; smooth, banding-free gradients in the sky; no halos around trees, roofs or the horizon.",
    "Painterly touch: a subtle fine-art finish over the photograph — soft, smooth tonal transitions, gently simplified fine detail in the distance and the sky, delicate soft edges on foliage and clouds, and a quiet luminous glow around the moon and the lamps, like a carefully hand-finished print; the subject stays crisp and real, with no visible brushstrokes, canvas texture or illustration look.",
    "Mood: serene, tranquil and peaceful; a quiet, real night in that place.",
    PEOPLE_SHARP,
    creamyBokeh("deep moonlit blues, dark foliage greens and soft warm lamp orbs"),
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, high contrast, punchy or dramatic look, a dark or silhouetted subject, crushed or deep black shadows, heavy vignette, overcooked HDR halos or grey flat tones, over-sharpening or clarity boost, visible brushstrokes or canvas texture, oversaturated or neon colours, replacing the described setting with a beach, sea or lagoon, glowing or radioactive turquoise water, purple tones, heavy fantasy glow, daylight, sunset or golden-hour sky, harsh flash, washed-out grey tones, CGI or illustration look, plastic textures, motion blur on people or animals, film grain, digital noise, speckled or blotchy skies, cluttered crowds, readable text, watermarks, logos.`,
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
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, replacing the described setting with a beach, sea or lagoon, photographic realism, camera noise or film grain, harsh black outlines, flat vector or cartoon style, anime look, muddy or dull colours, daylight, sunset or golden-hour sky, neon or purple tones, overly busy detail, cluttered crowds, readable text, signatures, watermarks, logos.`,
  ].join("\n");

/**
 * Bright, natural HDR finish used by Melancholy:
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
    "Camera and lens: flagship high-resolution full-frame camera with a premium 35mm–50mm prime stopped down to f/4–f/5.6; every person tack-sharp with high, photographic detail while the distant background dissolves into haze and creamy, textured bokeh; natural, lifelike perspective.",
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
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, harsh midday light, blue or cold colour casts, neon or oversaturated colours, an underexposed or silhouetted subject, a blown-out white sky or background, overcooked HDR halos or grey flat tones, a brightened or flattened background, a soft, hazy, blurry or out-of-focus person, haze or bloom over the people, an overall dreamy or soft-focus filter, busy, harsh, flat or fake-looking bokeh, thin, weak or barely visible haze, a clear flat sky with no atmosphere, crushed black shadows, cluttered crowds, posed smiling-at-camera portraits, plastic or airbrushed skin, CGI or illustration look, heavy grain or noise, readable text, watermarks, logos.`,
  ].join("\n");

/**
 * Director's Cut — reverse-engineered from a reference set of wide film stills
 * in a cavernous old workshop (two elderly craftsmen in conversation):
 *  - wide-angle establishing composition, characters full or three-quarter body, facing each other across the frame
 *  - shafts of volumetric light from high windows/skylights cutting through dust and haze, often between the characters
 *  - a strongly rustic, matte tone across the whole frame: earthy and timeworn, with aged wood, rust, burnt sienna and
 *    ochre, dusty parchment lights and dark umber shadows; restrained saturation, but neither cool nor a flat sepia filter
 *  - haze and visible dust speckles in the same rustic earth tones (real particles in the air, not image noise)
 *  - darkened surroundings like Focus: a pool of light on the people, with the scene falling into shadow around them
 *  - its own exposure line rather than BRIGHT_HDR: characters lifted out of the shadows, the background held
 *    about two stops lower and dark (also passed to subjectHdr); faint dust motes and dim bokeh orbs in the depth
 *  - tack-sharp characters with weathered faces and worn textures; the far background softened by haze
 *  - a clean, noise-free digital finish: smooth skin, natural (not boosted) texture, no film grain
 *  - separation by light: a large soft fill stays on the characters and the ground around them, while
 *    corners, ceiling and far walls fall off into deep umber that holds faint detail and never reaches pure black
 *  - photorealistic texture over punch: a soft, natural tonal curve, true-to-life skin and materials,
 *    no HDR tone-mapping crunch or boosted local contrast
 */
const DIRECTORS_CUT_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a wide cinematic frame from a modern prestige drama shot digitally — truly photorealistic, indistinguishable from a real photograph, deliberately staged like a director's frame, with the gravity and storytelling of an award-winning feature film; a clean, natural, high-end digital image, not a grainy film-stock look and not a punchy, processed or HDR-crunched look.",
    "Camera and lens: large-format digital cinema camera (ARRI Alexa 65 / Sony Venice class) at its base ISO, with a premium wide-angle cinema prime (24mm–35mm) stopped down to T4–T5.6 for high detail on the characters; clean, noise-free, grain-free capture with smooth tonal gradations; wide 3:2 / anamorphic-feel framing; straight verticals, minimal distortion; every character tack-sharp with high, photographic detail, the deep background gently softened by haze and creamy, textured bokeh.",
    "Composition: wide-angle establishing shot of a large, cavernous interior (old workshop, warehouse, mill, garage or barn); the characters shown full-body or three-quarter body, placed on the left and right thirds and facing each other in quiet conversation or shared work, with the light source or the main object between them; a sturdy worn table, bench or machine in the foreground; deep layered space receding behind them; high ceilings and tall windows visible.",
    "Lighting: natural, motivated light — dim, narrow shafts of soft, dusty daylight (god rays) in a faded parchment tone, as if filtered through old, grimy glass, streaming from high windows or skylights through dust and haze, cutting diagonally or straight down through the space; small, restrained practical accents such as sparks from a welder or grinder, bare tungsten bulbs and pendant lamps, which stay muted and never tint the frame; the characters gently rim-lit and side-lit, with soft, natural modelling on their faces; the far background falls off into dim, quiet shadow, with only faint window light and haze.",
    "Fill light: the characters are clearly the brightest, clearest part of the frame — a large, soft fill (as if from a big bounce board or a diffused source just off camera, plus light bounced from the sunlit floor and walls) lights their faces, eyes, hands and clothing evenly from the front, so every feature and fabric reads clearly and their skin looks natural; no part of a character falls into dark shadow. The fill stays on the characters and the ground right around them and does not spill into the background: the corners, ceiling, far walls and depths of the space fall off naturally into dark umber, where shapes and materials are still faintly visible.",
    "Darkened surroundings: the people stand in a pool of quiet light and everything around them falls away into shadow — the scene darkens steadily with distance from them, toward the far walls, the ceiling, the edges of the floor and all four corners of the frame, like real light falling off in a dark place rather than a filter; shapes there stay just visible in dark umber and old rust, and the light shafts and windows stay dim, so they never brighten the surroundings.",
    "Atmosphere: a dim, earthy haze hanging in the air, tinted smoky brown, faded ochre and dusty sienna like the air of an old mill or earth-floored barn, so the light shafts read as beams of brown, dusty light without lifting the dark background; clearly visible dust speckles drifting through the beams and the air behind and beside the people, real airborne particles in rustic tones of ochre, burnt sienna, tan and faded straw, varied in size and focus, some crisp and many softly out of focus, densest inside the light shafts and thinning into the shadows, and kept off the faces; a few faint round bokeh orbs in the same earth tones from distant lamps and sparks.",
    "Colour grade: a strongly rustic, earthy, matte grade that dominates the whole frame, timeworn like an old hand-tinted photograph of a working place — restrained saturation with a deep, unmistakable earthen warmth, so every part of the image reads as rust, clay, old wood or dry earth; windows, haze and light shafts in dim, dusty parchment, faded ochre and smoky brown; walls, metal and shadows in dark umber, rust-brown and old iron; wood, earth, rust and floors in weathered walnut, burnt sienna, terracotta and faded ochre, with only touches of dull olive; clothing in subdued, sun-faded, earth-toned versions of its real colours; skin is natural, muted and weathered, a sun-worn brown that still looks healthy; hues stay close together in the earth family but tones stay clearly separated, with clearly lit characters against a dark background; dark umber shadows that keep faint detail and are never pure black.",
    "Tone and contrast: moderate overall contrast that comes from clearly lit characters against a dark background, with a soft, natural photographic tonal curve and gentle highlight roll-off, like a real cinema camera's log footage graded with restraint; a matte finish whose background highlights stop at a dim, muted parchment and whose darkest areas are a deep umber with quiet detail rather than pure black; overall a dark, subdued exposure, never sunny or glowing; the characters lifted well out of the shadows and clearly lit, the depth of the interior reading through faint, layered dark tones; low, natural local contrast on faces, hands and fabric (no clarity or structure boost, no HDR tone-mapping, no gritty micro-contrast); soft, natural gradients in the haze, the light shafts and the walls, with no digital noise in them.",
    "Texture and realism: photorealistic, true-to-life surfaces exactly as a high-end camera records them — natural skin with real pores, fine lines and subtle variation in tone (neither airbrushed nor exaggerated); real cotton, denim and leather, worn and softened by years of use; old timber, iron, plaster and rust with a real aged patina; texture is resolved by the optics, not added by sharpening or contrast, so detail reads crisp and real rather than etched or crunchy.",
    "HDR exposure: a natural, blended-exposure finish — the characters are lifted and well exposed, with clear faces, skin, hands and clothing, never a dark silhouette; the background (walls, windows, haze and light shafts) sits about two stops below them, dark and subdued, keeping faint detail and never blowing out to white; dark shadows that still hold detail; clean, natural tonality with no halos and no over-processed look.",
    subjectHdr("the background is held well below the people, about two stops darker and dark overall, falling off naturally with distance from the light on them, so subject and background still feel lit by the same world"),
    peopleSharp("very high optical resolution with natural micro-contrast, so detail is crisp and real rather than crunchy or etched"),
    creamyBokeh("dark umber, smoky brown, rust and dull ochre tones from the dim depths of the space, with a few faint round earth-toned orbs from distant lamps and sparks"),
    "Detail: natural, photographic detail on the characters — weathered skin with real texture and soft tonality, wrinkles, grey hair and stubble, worn work jackets and caps; rustic, hand-worn tools and surfaces — aged wood grain, rusted iron, flaking paint, patched walls and packed-earth or worn concrete floors, as fits the scene, softened by distance and never busy; natural, authentic expressions.",
    "Mood: rustic, timeworn, contemplative, dignified and intimate; a meaningful moment between people in a place shaped by years of work; nostalgic yet grounded.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, close-up portrait framing, flat lighting without shafts or direction, characters lost in shadow, dark or underlit faces, half-shadowed faces, silhouettes, a bright, airy or evenly lit background, a background as bright as the characters, pale walls or a hazy white glow, a spotlit or cut-out look, blown-out white windows or light shafts, crushed black shadows, high contrast, punchy, dramatic or harsh look, HDR tone-mapped or crunchy look, etched or over-defined detail, bright frame edges or corners, an artificial oval vignette, cartoon, illustration or CGI look, plastic skin, vivid, rich or saturated colours, overcooked HDR halos or lifeless, washed-out flat tones, a soft or out-of-focus character, busy, harsh, flat or fake-looking bokeh, film grain, digital noise or sensor speckle in the image itself, white, grey or blue haze or dust, clean clear air, dust covering a face, over-sharpening, heavy clarity or texture boost, rough or pitted skin, new, polished, glossy or spotless surfaces, a modern, clean or industrial-chrome look, cluttered crowds, readable text, watermarks, logos, a glowing golden, amber or honey cast, a golden-hour or sunset glow, teal-and-orange split toning, a cool blue, slate or steel-grey cast, a black-and-white or fully desaturated look, a flat sepia or monochrome-brown filter, ashen, grey, orange or yellow skin.`,
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
    "Camera and lens: flagship high-resolution camera (Hasselblad X2D 100MP / Sony A1 / Leica SL3 class) with a premium 35mm prime (Leica Summilux / Zeiss Otus class) stopped down to f/4–f/5.6, focused precisely on the person's eyes; the subject critically sharp — clearly resolved eyes, lashes and brows, skin texture and fine lines, individual strands of hair, crisp fabric weave and the fine detail of their hands; the far background melting into creamy bokeh and mist.",
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
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, close-up portrait framing, crowds or extra people near the subject, harsh midday light, cold or blue colour casts, oversaturated colours, an underexposed or silhouetted subject, a dark, shadowed or backlit-black face, eyes lost in shadow, a tiny distant figure with no facial detail, an overly bright, glaring, washed-out or hazy-white background, a large blinding sun or heavy lens flare, a blown-out sky, overcooked HDR halos or grey flat tones, a brightened or flattened background, a soft, hazy, blurry or out-of-focus subject, mist or bloom over the person, an overall dreamy or soft-focus filter, busy, harsh, flat or fake-looking bokeh, crushed black shadows, plastic or airbrushed skin, cartoon, illustration or CGI look, heavy grain or noise, readable text, watermarks, logos.`,
  ].join("\n");

/**
 * Landscape — professional Philippine landscape photography: a wide, realistic view with a
 * cinematic sky, a smooth editorial HDR balance between light and shadow, and front-to-back
 * ultra-sharp detail from a high-end camera stopped down to its sharpest landscape aperture.
 * No bokeh: unlike the people-led styles, everything from foreground to horizon is in focus.
 */
const LANDSCAPE_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a professional, award-quality landscape photograph — photorealistic and true to life, the kind of image published in National Geographic or a premium travel and editorial magazine; a natural, believable scene with a cinematic sky and a clean, refined editorial finish.",
    "Setting: the landscape described above, in the Philippines unless another place is named — for example rice terraces, volcanoes and mountain ranges, limestone karsts and lagoons, white-sand coves, coconut-lined coasts, rolling hills, rivers and waterfalls, farmland and barrios; keep the place and viewpoint described, and add people only if they are described (then small in the scene, natural and Filipino).",
    "Camera and lens: flagship high-resolution camera (Hasselblad X2D 100MP / Phase One IQ4 / Sony A7R V / Nikon Z8 class) on a sturdy tripod at base ISO (ISO 64–100), with a premium wide-angle to normal landscape lens (16–35mm or 24–70mm, Zeiss / Leica / Sony GM class) stopped down to f/8–f/11 for maximum sharpness; focused at the hyperfocal distance so everything from the nearest foreground rock or leaf to the far horizon is critically sharp; straight horizon, corrected verticals, no distortion.",
    "Composition: a wide, carefully composed landscape with strong layered depth — a clear foreground interest (rocks, grasses, a path, terraces, water or a tree), a defined middle ground and a far background of hills, mountains, sea or sky; leading lines and natural curves guiding the eye; the horizon placed on a third, with generous space for the sky.",
    "Sky: a cinematic, dramatic but realistic sky — sculpted cumulus or layered clouds catching warm light, rich colour and gradation (golden hour, sunrise or sunset glow, or clear deep blue with textured clouds, as fits the scene), sunbeams breaking through where natural; detailed and believable, never a pasted-in or fantasy sky.",
    "Lighting: beautiful natural light — low, warm, directional sun at golden hour or soft early-morning light raking across the land, revealing texture and shape; gentle shadows that model the terrain; light and shadow balanced so both the sky and the land are fully readable.",
    "HDR balance: a smooth, editorial HDR finish, as if several bracketed exposures were blended with care — highlights in the sky and sun held with detail and no clipping, shadows in valleys, foliage and rocks opened up with clear detail and no crushed blacks; a balanced, natural tonal range with gentle, even transitions between light and shadow; no halos around mountains, trees or the horizon, no grey, flat or over-processed HDR look, no artificial glow.",
    "Sharpness and detail: ultra-sharp from front to back, with professional, high-resolution detail like a 100MP landscape file viewed at 100% — individual leaves and blades of grass, rock texture, the ridges of rice terraces, tree bark, ripples and foam on water, distant trees and houses on the hills still crisply resolved; high resolving power and natural micro-contrast; clean, noise-free and grain-free; no softness, smearing, over-sharpening halos or AI-smoothed textures.",
    "Colour grade: rich yet natural, true-to-life colour — lush greens of rice fields and forest, clean turquoise and blue water where there is any, warm earth and sand tones, a sky with natural warm and cool gradation; moderate, realistic saturation with no neon or oversaturated colours; accurate white balance.",
    "Mood: awe-inspiring, peaceful and inviting; a breathtaking, real place in the Philippines that makes you want to be there.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, shallow depth of field, background blur or bokeh, soft or out-of-focus foreground or horizon, flat or dull grey sky, pasted-in or fantasy sky, blown-out sky or sun, crushed black shadows, overcooked HDR halos or grey flat tones, oversaturated or neon colours, tilted horizon, heavy vignette, haze that hides the landscape, film grain, digital noise, over-sharpening, CGI or illustration look, cluttered tourist crowds, readable text, watermarks, logos.`,
  ].join("\n");

/** A prompt naming smoke or something that makes it gets PORTRAIT_SMOKE; every other Portrait stays smoke-free. */
const SMOKE_SOURCE = /(?<!\b(?:no|without) )\b(?:smok(?:e|es|ed|er|ing|y)|usok|cigars?|cigarettes?|sigarilyo|tabako|tobacco|pipes?|incense|vap(?:e|es|ing))\b/i;

const PORTRAIT_SMOKE =
  "Smoke: emphasised, sculptural smoke as a major element of the picture, rising from the source described — a dense, bright ribbon near the source that twists upward into curling, layered filaments and then opens into soft veils filling the dark space beside the face; lit by the same side light so it stands out in pale silver-grey against the black background, with fine, clearly resolved wisps and real volume; it stays beside and in front of the empty space, never covering the eyes or the main features of the face.";

/**
 * Portrait — reverse-engineered from a reference of an elderly man with a pipe, close up against black:
 *  - an extreme close-up in a horizontal 3:2 frame: the face fills most of the height, off-centre,
 *    turned in three-quarter or profile toward open dark space
 *  - a studio setup: a directional side key plus large soft fill and ambient light that open up the dark areas of
 *    the person (shadow side of the face, eye sockets, neck, hands, clothing), while the background stays black
 *  - high contrast reserved for the facial contours (brow, eye sockets, nose, cheekbones, folds, jaw), dodged and burned
 *    to emphasise them; skin between the contours, hands, hair and clothing stay at a natural, moderate contrast
 *  - ultra-sharp facial contours, with a stronger detail pass of its own (`finish: "ultra"`)
 *  - a heavily muted grade with chocolate brown skin (a dark complexion that is still well lit), restrained colour in patterned fabrics
 *  - emphasised smoke only when the prompt calls for it (SMOKE_SOURCE)
 * Uses peopleSharp, but not SUBJECT_HDR or creamyBokeh: the background is plain black and the face keeps hard modelling.
 */
const PORTRAIT_TEMPLATE = (subject: string) => {
  const smoke = SMOKE_SOURCE.test(subject);
  return [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a dramatic fine-art close-up portrait in landscape orientation — photorealistic, indistinguishable from a real photograph, with the intensity of an award-winning character study.",
    "Camera and lens: flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class) at base ISO with a premium 85mm–105mm portrait or macro prime stopped down to f/5.6–f/8, so the whole face from nose to ear is in sharp focus; natural facial proportions with no wide-angle distortion.",
    "Composition: a horizontal 3:2 frame with an extreme close-up of the head and upper shoulders; the face fills most of the frame height and sits off-centre on one side, turned in three-quarter view or profile toward open dark space on the other side, with the top of the head or headwear and the shoulders allowed to crop close to the frame edge; a hand and what it holds may rise into the foreground only if described; the person is candid and absorbed, not posing for the camera.",
    "Lighting: a professional studio portrait setup — one large directional key light from the side the person is facing, slightly above eye level, raking across the skin to sculpt the brow, cheekbone, nose and jaw; the eyes stay clearly visible with a small natural catchlight; no flash look.",
    "Fill and ambient light on the person: a large, soft fill (a big bounce board or softbox on the shadow side) plus even studio ambient light opens up every dark area of the person — the shadow side of the face, eye sockets, under the nose and chin, the neck, ear, hair, hands and clothing are all clearly lit and readable, with visible skin colour, texture and fabric pattern, about one to one and a half stops below the key and never black; the light is confined to the person and does not spill onto the background.",
    "Background: a plain, seamless, near-black background with no visible place, objects or other people, separated from the person only by the light falling on them.",
    "Colour grade: a heavily muted, desaturated grade built around the skin — unless the description names another complexion, a muted chocolate brown complexion with soft cocoa and chocolate midtones, restrained, dusty milk-chocolate highlights on the forehead, nose and cheekbones, and deep dark-chocolate shadows, a neutral, matte brown with natural variation and very little saturation, neither reddish nor golden; the darkness belongs to the complexion, not the exposure, so the skin stays well lit and fully readable; a neutral black background; clothing and headwear in subdued, greyed versions of their colours, with any woven or printed pattern crisp and clearly visible.",
    "Tone and contrast: high contrast is reserved for the facial contours and used nowhere else; the skin between the contours, the hair, neck, hands and clothing all keep a natural, moderate contrast with soft, smooth tonal transitions, so the contours are what the eye goes to; controlled, muted highlights on the forehead, cheekbones and nose; no broad dark areas, so the whole person stays open and well lit against the background; highlights never clip and the background stays deep black.",
    "Facial contours: the emphasis of the picture — ultra-sharp, high-contrast contours across the face, as if carefully dodged and burned by a master retoucher: the brow ridge, eyelids, eye sockets, bridge and wings of the nose, cheekbones, the folds beside the mouth, lips, jawline and chin are all crisply defined, with a bright, controlled edge of light beside a deepened line of shadow, every plane of the face reading as distinct, sculpted form.",
    "Facial detail: extremely detailed skin true to the person's age — every pore, wrinkle, crease, freckle, scar, sun spot and vein individually resolved where the person has them; individual hairs in the brows, lashes, stubble and beard; moist, lifelike eyes; lips, ears and hands with the same fine texture; clean, photographic detail with no digital noise.",
    peopleSharp("ultra-sharp rendering with the highest resolving power on the face, hands and fabric, with every contour and fine detail crisply defined"),
    ...(smoke ? [PORTRAIT_SMOKE] : []),
    "Mood: intense, intimate and contemplative; a whole life readable in one face; quiet dignity.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, ${smoke ? "smoke hiding the eyes or face, thin, faint or barely visible smoke, flat cloud-like fog" : "smoke, haze or mist"}, full-body, wide or environmental framing, a visible room or scenery, a busy or lit background, a grey or coloured backdrop, flat frontal lighting, soft or low-contrast facial contours, high contrast on the hair, hands or clothing, harsh, blotchy or over-contrasted skin between the contours, a washed-out face, a dark, underexposed or half-shadowed face, black eye sockets, a neck, ear, hands or clothing lost in shadow, crushed shadows on the person, light, tan, golden, copper or reddish skin, shiny or glowing skin, ashen or grey skin, vivid or saturated colours, soft or undefined facial contours, smooth, plastic or airbrushed skin, invented wrinkles on a young face, a soft or out-of-focus face, shallow focus that blurs part of the face, wide-angle distortion, a posed smile at the camera, oversaturated or orange skin, overcooked HDR halos or glowing outlines around the face, crunchy over-sharpening, film grain, digital noise, cartoon, illustration or CGI look, readable text, signatures, watermarks, logos.`,
  ].join("\n");
};

/**
 * Focus (id "heritage") — reverse-engineered from four fine-art environmental portraits of people in traditional dress
 * (an elder and a boy on a bamboo rail over water, a man with baskets by an old wall, a farmer under a dark sky,
 * two women at a spinning wheel in misty forest):
 *  - one or two people full-body or three-quarter, posed quietly in their own place, with handmade objects of daily life
 *  - a studio-quality soft key carried on location, so the people glow against a much darker scene
 *  - low-key overall (median luma about 35–75, with real blacks), like an Old Master painting but photographic
 *  - a background of slate teal, moss green and smoky grey-blue (#1f2d2f–#3b5048) falling into mist or shadow
 *  - warm brown skin (#58412c–#7f5c41), with the only rich colour in the textiles: gold, mustard, brick red, indigo
 *  - ultra-sharp, highly detailed people and fabric (with `finish: "ultra"`), against a soft, painterly background
 */
const FOCUS_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    PHILIPPINES,
    "Style: a fine-art environmental portrait with the quiet grandeur of an Old Master painting, yet fully photographic — photorealistic, retouched with great care, like an award-winning cultural portrait series; a timeless, carefully staged picture of people in their own place.",
    "Camera and lens: flagship high-resolution camera (medium-format 100MP or full-frame 50–60MP class) at base ISO with a premium 50mm–85mm prime stopped down to f/4–f/5.6; every person tack-sharp, the background far behind them and dissolving softly; natural, undistorted proportions.",
    "Composition: a horizontal 3:2 frame with one or two people shown from about the knees or waist up (full-body only if the description calls for it), so their faces are large enough to hold fine detail, filling most of the frame height and placed off-centre on one side, still and unhurried, with the dark, atmospheric place opening out on the other side; if there are two, they are close together and connected by a glance, a touch or a shared task; handmade objects of their daily life fitting the scene (woven baskets, clay pots, bamboo, a loom or wheel, tools) sit in the foreground or in their hands; plants, a worn step, an old wall or still water frame them, with calm dark space around them.",
    "Lighting: a large, soft, directional key light carried on location, like a big softbox or beauty dish at about 45 degrees to one side and slightly above, sculpting faces, shoulders, arms, hands and fabric with a smooth, luminous falloff; gentle fill opens the shadow side so eyes and features stay clear; a subtle rim separates hair and shoulders from the background; the people are about two stops brighter than everything behind them, as if a pool of quiet light found them in a dark place, while still feeling part of the scene.",
    "Background and atmosphere: the place described, sinking into deep shadow, soft mist, smoke or a dark brooding sky with real depth; shapes stay recognisable but quiet; any light in the far distance is a soft, muted glow; where there is water, it is dark and still with soft reflections of the people.",
    "Colour grade: a rich, moody, low-key grade — a background of deep slate teal, moss green, smoky grey-blue and dark umber; warm brown, sun-worn skin with natural variation; the strongest colour reserved for clothing and handmade objects, in deep antique gold, mustard, brick red, indigo and straw, rich but never bright; overall restrained saturation, with warm subjects set against a cool, dark world.",
    "Tone and contrast: low-key overall with true, deep blacks and detail just above them; very high local contrast and careful dodging and burning on the people, so skin, muscle, wrinkles and fabric folds read as sculpted form; highlights on skin stay controlled and never clip; a soft, painterly smoothness in the background only.",
    "Clothing and texture: traditional or handmade dress fitting the person and place unless the description says otherwise — hand-woven and patterned textiles, sashes, headcloths and woven hats, often barefoot — with every thread, pattern, fold and worn edge crisply visible; weathered skin, worn wood, stone, rope and basketry with a real, aged patina.",
    "Human detail: every person is ultra-sharp and extremely detailed from head to toe, the clearest thing in the picture — crisply defined facial contours, eyelids, irises and catchlights, individual lashes, brows and strands of hair, every pore, wrinkle, freckle and vein true to the person's age, the tendons and creases of hands and feet, and the definition of muscle and collarbone on any bare skin; this holds for each person in the frame, including a second person and any hands or feet further from the lens.",
    subjectHdr("the background is held well below the people, about two stops darker and low-key, falling off naturally away from the light on them, so subject and background still feel part of the same world"),
    peopleSharp("ultra-sharp rendering with the highest resolving power and strong micro-contrast on the people, their clothing and what they hold, every contour and fine detail crisply defined"),
    creamyBokeh("deep slate teal, moss green and smoky grey-blue, with soft, muted glows of distant light"),
    "Mood: quiet, dignified, tender and timeless; an unhurried moment of daily life, handed down through generations; the people absorbed in each other or their work, or gazing thoughtfully past the camera.",
    NATURAL_ANATOMY,
    `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}, bright or sunny daylight, a bright, pale or busy background, a plain studio backdrop, a cut-out or pasted-in look, a hard flash look, harsh shadows on the face, a dark or underlit face, silhouettes, eyes lost in shadow, blown-out highlights, shiny or oily skin, plastic or airbrushed skin, neon, vivid or oversaturated colours, an orange-and-teal poster look, overcooked HDR halos or glowing outlines, crunchy over-sharpening, modern clothing, modern objects, logos or printed slogans unless described, tourist-costume or stereotyped dress, smiling at the camera, a tight close-up or a wide shot with tiny figures, a soft or out-of-focus person, any softness, smoothing or painterly rendering on a person, waxy skin, undefined facial features, soft hands or feet, busy, harsh, flat or fake-looking bokeh, film grain, digital noise, cartoon, illustration or CGI look, visible brushstrokes, readable text, signatures, watermarks.`,
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
    swatch: ["#17120e", "#4f3f2f", "#a58a60"],
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
    id: "landscape",
    finish: "crisp",
    name: "Landscape",
    tagline: "Pro Philippine landscapes, cinematic sky",
    swatch: ["#1f3b2f", "#4d8a6a", "#f2c27a"],
    build: LANDSCAPE_TEMPLATE,
  },
  {
    id: "portrait",
    finish: "ultra",
    aspect: "landscape",
    name: "Portrait",
    tagline: "Close-up faces with sculpted, contrasty contours",
    swatch: ["#0c0b0a", "#4a3628", "#b39474"],
    build: PORTRAIT_TEMPLATE,
  },
  {
    // Saved images store this id, so it stayed "heritage" when the style was renamed to Focus.
    id: "heritage",
    finish: "ultra",
    aspect: "landscape",
    name: "Focus",
    tagline: "Ultra-sharp people in dark, misty places",
    swatch: ["#141c1c", "#3b5048", "#c9a06a"],
    build: FOCUS_TEMPLATE,
  },
  {
    id: "raw",
    finish: "none",
    name: "Raw",
    tagline: "Your prompt, with the shared checks only",
    swatch: ["#1a1918", "#6b6660", "#ece6dc"],
    build: (subject) => [subject.trim(), PHILIPPINES, PEOPLE_SHARP, creamyBokeh("the natural colours of the scene"), NATURAL_ANATOMY, `Avoid: ${AI_ARTEFACTS}, ${NOT_PHILIPPINES}.`].join("\n"),
  },
];

export const DEFAULT_STYLE: StyleId = "cinematic";

/** Unknown or retired style ids (e.g. an old "dramatic" record) fall back to Cinematic. */
export function getStyle(id: string | undefined): StylePreset {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
