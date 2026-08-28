// src/lib/images.ts
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

type ImageType = "driver" | "team" | "flags" | "trackImage" | "siteImage";

// Every photo a track has, in variant order.
const trackVariants: Record<string, string[]> = {};

const maps: Record<ImageType, Record<string, string>> = {
  driver: {},
  team: {},
  flags: {},
  trackImage: {},
  siteImage: {},
};

// Grab all supported images (adjust patterns/paths as needed)
const allImages = import.meta.glob(
  "../assets/{driver-profiles,team-logos,flags,track-images,site-images}/*.{jpg,png,webp,svg}",
  { eager: true, as: "url" }
);

// Build lookup maps keyed by the slugified base filename
for (const [key, url] of Object.entries(allImages)) {
  // key example: "../assets/driver-profiles/max-verstappen.jpg"
  const parts = key.split("/");
  const folder = parts[parts.length - 2]; // e.g., "driver-profiles"
  const filename = parts[parts.length - 1]; // e.g., "max-verstappen.jpg"
  const base = filename.replace(/\.[^.]+$/, ""); // "max-verstappen"

  const slug = base; // already kebab, or slugify if your names aren’t
  if (folder === "driver-profiles") maps.driver[slug] = url as string;
  if (folder === "team-logos") maps.team[slug] = url as string;
  if (folder === "flags") maps.flags[slug] = url as string;
  if (folder === "site-images") maps.siteImage[slug] = url as string;
  if (folder === "track-images") {
    // A track may have more than one photo: "bahrain.jpg" is the first,
    // "bahrain-2.jpg" the second, and so on. No track slug ends in -<digit>,
    // so the suffix is unambiguous.
    const variant = slug.match(/^(.*)-([2-9])$/);
    const trackSlug = variant ? variant[1] : slug;
    const index = variant ? Number(variant[2]) - 1 : 0;
    (trackVariants[trackSlug] ||= [])[index] = url as string;
    if (index === 0) maps.trackImage[trackSlug] = url as string;
  }
}

// Holes are possible if a -3 lands without a -2; drop them so callers can index
// the list freely.
for (const slug of Object.keys(trackVariants)) {
  trackVariants[slug] = trackVariants[slug].filter(Boolean);
  maps.trackImage[slug] ??= trackVariants[slug][0];
}

export function displayImage(name: string, type: ImageType): string | undefined {
  const slug = slugify(name);
  return maps[type][slug]; // returns hashed URL at runtime; may be undefined if not found
}


/** Every photo available for a track, in variant order. */
export function trackImages(name: string): string[] {
  return trackVariants[slugify(name)] ?? [];
}

/**
 * One of a track's photos, chosen by `pick`. Out-of-range values wrap, so a
 * caller can pass a raw article id or a hash without knowing how many exist.
 */
export function trackImage(name: string, pick: number): string | undefined {
  const variants = trackImages(name);
  if (variants.length === 0) return undefined;
  return variants[((pick % variants.length) + variants.length) % variants.length];
}

// Rolled once when the bundle loads, so a given track shows the same photo for
// the whole visit — no reshuffling as components re-render — and a new one on
// refresh. Mixed with the slug so two tracks on a page do not move in lockstep.
const VISIT_ROLL = Math.floor(Math.random() * 1_000_003);

/** A track photo that varies between page loads. For anywhere a track appears
 *  incidentally — cards, teasers, hero images. */
export function randomTrackImage(name: string): string | undefined {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return trackImage(name, Math.abs(hash + VISIT_ROLL));
}

/**
 * The photo for an article, fixed to the article so a piece of writing always
 * looks the same and a preview never shares its picture with the recap of the
 * same race.
 */
export function articleTrackImage(name: string, type: string, id: number): string | undefined {
  if (type === "PREVIEW") return trackImage(name, 0);
  if (type === "RECAP") return trackImage(name, 1);
  return trackImage(name, id);
}
