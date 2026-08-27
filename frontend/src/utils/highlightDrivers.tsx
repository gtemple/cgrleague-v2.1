import React from "react";

/**
 * Article text does not always use a driver's full name. When two drivers share
 * a surname the generator is instructed to write them as "C. Reynolds" /
 * "R. Reynolds" throughout, so matching full names alone highlighted almost
 * none of them: across one season's articles "C. Reynolds" appeared 39 times
 * against 13 for "Cole Reynolds". Each name therefore also matches its
 * initial form.
 */
function aliasesFor(name: string): string[] {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return [name];
  const [first, ...rest] = parts;
  const last = rest.join(" ");
  return [name, `${first[0]}. ${last}`];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits `text` on any occurrence of a driver's name (full or initialled,
 * case-insensitive) and wraps matches in a <mark> with the given className.
 */
export function highlightDrivers(
  text: string,
  names: string[],
  className: string
): React.ReactNode {
  if (!names.length) return text;

  const aliases = Array.from(new Set(names.flatMap(aliasesFor)));
  if (!aliases.length) return text;

  // Longest first so "Cole Reynolds" is preferred over any shorter overlap.
  const ordered = [...aliases].sort((a, b) => b.length - a.length);
  const lookup = new Set(aliases.map((a) => a.toLowerCase()));

  const pattern = new RegExp(`(${ordered.map(escapeRe).join("|")})`, "gi");

  return text.split(pattern).map((part, i) =>
    lookup.has(part.toLowerCase()) ? (
      <mark key={i} className={className}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}
