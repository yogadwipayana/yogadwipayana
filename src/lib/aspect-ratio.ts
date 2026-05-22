/**
 * Aspect-ratio presets for image generation.
 *
 * Different image providers want different shapes for the same intent: OpenAI
 * accepts `1024x1024`, Stability uses `aspect_ratio: "16:9"`, FLUX wants exact
 * width/height. The UI exposes a single preset; this module maps it to the
 * canonical OpenAI-compatible `size` string that 9router accepts for the
 * cx/gpt-5.4-image route we use today, plus side data callers can use to
 * switch providers later without touching the UI.
 */

export type AspectRatioPreset =
  | "auto"
  | "square"
  | "portrait"
  | "landscape"
  | "wide"
  | "tall";

export type AspectRatioOption = {
  preset: AspectRatioPreset;
  /** Display label for UI controls. */
  label: string;
  /** Single-word hint shown under the label. */
  description: string;
  /** Canonical OpenAI-style `size` string (or `"auto"`). */
  size: string;
  /** `width:height` ratio for providers that prefer ratios. */
  aspectRatio: string;
  /** Explicit width/height for providers like FLUX that need exact dims. */
  width: number | null;
  height: number | null;
};

export const ASPECT_RATIO_OPTIONS: readonly AspectRatioOption[] = [
  {
    preset: "auto",
    label: "Auto",
    description: "Let the model decide",
    size: "auto",
    aspectRatio: "auto",
    width: null,
    height: null,
  },
  {
    preset: "square",
    label: "Square",
    description: "1:1 · social posts, avatars",
    size: "1024x1024",
    aspectRatio: "1:1",
    width: 1024,
    height: 1024,
  },
  {
    preset: "portrait",
    label: "Portrait",
    description: "3:4 · headshots, posters",
    size: "1024x1536",
    aspectRatio: "3:4",
    width: 1024,
    height: 1536,
  },
  {
    preset: "landscape",
    label: "Landscape",
    description: "4:3 · scenes, illustrations",
    size: "1536x1024",
    aspectRatio: "4:3",
    width: 1536,
    height: 1024,
  },
  {
    preset: "wide",
    label: "Wide",
    description: "16:9 · banners, OG images",
    size: "1792x1024",
    aspectRatio: "16:9",
    width: 1792,
    height: 1024,
  },
  {
    preset: "tall",
    label: "Tall",
    description: "9:16 · mobile, stories",
    size: "1024x1792",
    aspectRatio: "9:16",
    width: 1024,
    height: 1792,
  },
] as const;

const BY_PRESET: Record<AspectRatioPreset, AspectRatioOption> =
  ASPECT_RATIO_OPTIONS.reduce(
    (acc, opt) => {
      acc[opt.preset] = opt;
      return acc;
    },
    {} as Record<AspectRatioPreset, AspectRatioOption>,
  );

export function getAspectRatio(preset: AspectRatioPreset): AspectRatioOption {
  return BY_PRESET[preset] ?? BY_PRESET.auto;
}

/** Convert a preset to the OpenAI-compatible `size` string. */
export function presetToSize(preset: AspectRatioPreset): string {
  return getAspectRatio(preset).size;
}

/**
 * Normalize free-form input from a tool argument back to a preset. Accepts
 * "auto", direct preset names, sizes like "1024x1024", or aspect ratios like
 * "16:9". Falls back to "auto" if the input is unrecognized.
 */
export function normalizeAspectInput(
  raw: string | undefined,
): AspectRatioPreset {
  if (!raw) return "auto";
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "auto";

  if ((trimmed as AspectRatioPreset) in BY_PRESET) {
    return trimmed as AspectRatioPreset;
  }

  for (const opt of ASPECT_RATIO_OPTIONS) {
    if (opt.size.toLowerCase() === trimmed) return opt.preset;
    if (opt.aspectRatio === trimmed) return opt.preset;
  }
  return "auto";
}
