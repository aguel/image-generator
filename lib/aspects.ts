// Aspect ratio presets mapped to sizes supported by the OpenAI image API.

export type AspectId = "landscape" | "square" | "portrait";

export interface AspectPreset {
  id: AspectId;
  label: string;
  ratio: string;
  size: `${number}x${number}`;
  width: number;
  height: number;
}

export const ASPECTS: AspectPreset[] = [
  { id: "landscape", label: "Landscape", ratio: "3:2", size: "1536x1024", width: 1536, height: 1024 },
  { id: "square", label: "Square", ratio: "1:1", size: "1024x1024", width: 1024, height: 1024 },
  { id: "portrait", label: "Portrait", ratio: "2:3", size: "1024x1536", width: 1024, height: 1536 },
];

export const DEFAULT_ASPECT: AspectId = "landscape";

export function getAspect(id: string | undefined): AspectPreset {
  return ASPECTS.find((a) => a.id === id) ?? ASPECTS[0];
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 8;
