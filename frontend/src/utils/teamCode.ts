const KNOWN_CODES: Record<string, string> = {
  "ferrari": "FER",
  "mclaren": "MCL",
  "aston martin": "AMR",
  "red bull": "RBR",
  "mercedes": "MER",
  "haas": "HAS",
  "alpha tauri": "VCA",
  "visa cash app racing bulls formula one team": "VCA",
  "alfa romeo": "ALF",
  "williams": "WIL",
  "alpine": "ALP",
  "cadillac": "CAD",
  "sauber kick": "SAU",
};

export function teamCode(name: string | null | undefined): string {
  if (!name) return "";
  const known = KNOWN_CODES[name.trim().toLowerCase()];
  if (known) return known;
  return name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
}
