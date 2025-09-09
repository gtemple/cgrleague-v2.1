// src/lib/images.ts
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

type ImageType = "driver" | "team" | "flags" | "trackImage";

const maps: Record<ImageType, Record<string, string>> = {
  driver: {},
  team: {},
  flags: {},
  trackImage: {},
};

// Grab all supported images (adjust patterns/paths as needed)
const allImages = import.meta.glob(
  "../assets/{driver-profiles,team-logos,flags,track-images}/*.{jpg,png,webp,svg}",
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
  if (folder === "track-images") maps.trackImage[slug] = url as string;
}

export function displayImage(name: string, type: ImageType): string | undefined {
  const slug = slugify(name);
  return maps[type][slug]; // returns hashed URL at runtime; may be undefined if not found
}
