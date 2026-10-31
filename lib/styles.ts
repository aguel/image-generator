// Style presets. Each style wraps the user's subject in a prompt template.
// Add a new style by appending to STYLES — the UI picks it up automatically.

export type StyleId = "cinematic" | "raw";

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
 *  - razor-sharp subject with visible skin pores, sweat and fabric weave
 *  - shallow depth of field, 35–50mm full-frame look, creamy practical-light bokeh
 *  - gritty, lived-in environment rich in texture (grime, oil, worn metal)
 *  - candid documentary realism, off-centre editorial framing
 */
const CINEMATIC_TEMPLATE = (subject: string) =>
  [
    `${subject.trim().replace(/\.$/, "")}.`,
    "Style: cinematic environmental documentary portrait, photorealistic, shot on a full-frame mirrorless camera with a 35mm–50mm prime lens wide open at f/1.4–f/2, editorial magazine photography with natural filmic tonality.",
    "Composition: eye-level medium shot (roughly waist-up), subject placed off-centre on a rule-of-thirds line, hands busy with or resting near tools and props on a worn surface in the foreground that leads into the frame.",
    "Lighting: low-key and moody, motivated by practical sources only — overhead fluorescent tube lights and warm tungsten work lamps casting a soft amber glow from above and to the side, sculpting faces and forearms with gentle falloff into deep shadow; subtle rim light separating the subject from the background.",
    "Colour grade: orange-and-teal film grade — warm amber/copper skin tones and highlights against cool teal, cyan and slate-blue shadows; muted, slightly desaturated midtones with selective saturated accents (rust red, workshop blue, safety yellow); rich, deep blacks with a faint matte lift.",
    "Tone and contrast: high micro-contrast and clarity, punchy local contrast, crisp tonal separation, dramatic chiaroscuro, no blown highlights.",
    "Sharpness and depth: razor-thin plane of focus — tack-sharp on the subject's eyes, face and hands with hyper-detailed textures (visible skin pores, sweat sheen, stubble, fabric weave, grease, scratches, worn metal), while the background is clearly out of focus and melts into creamy bokeh with soft glowing practical lights, out-of-focus figures and hazy atmospheric depth.",
    "Environment: gritty, cluttered, authentic and lived-in, layered foreground/midground/background depth, dust and light haze in the air, tactile surfaces with grime and patina.",
    "Mood: candid, serious, dignified, quietly intense; natural unposed expression; storytelling realism.",
    "Avoid: cartoon, illustration, CGI look, plastic or airbrushed skin, flat lighting, HDR or over-processed look, deep focus with everything sharp, sharpening halos, oversaturation, readable text, watermarks, logos.",
  ].join("\n");

export const STYLES: StylePreset[] = [
  {
    id: "cinematic",
    name: "Cinematic",
    tagline: "Moody film look",
    swatch: ["#0f1a1c", "#3f6f73", "#e39a4c"],
    build: CINEMATIC_TEMPLATE,
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

export function getStyle(id: string | undefined): StylePreset {
  return STYLES.find((s) => s.id === id) ?? STYLES[0];
}
