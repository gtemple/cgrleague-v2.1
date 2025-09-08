export const displayImage = (name: string, type: string) => {
  let typePath = '';
  console.log(name)
  if (type === 'driver') typePath = 'driver-profiles';
  if (type === 'team') typePath = 'team-logos';
  // Convert name to lowercase, replace spaces with hyphens, remove non-alphanumerics except hyphens
  const fileName = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  // Path relative to public or src/assets
  return `/src/assets/${typePath}/${fileName}.jpg`;
};