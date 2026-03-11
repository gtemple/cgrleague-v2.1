import React from "react";

/**
 * Splits `text` on any occurrence of a driver's full name (case-insensitive)
 * and wraps matches in a <mark> with the given className.
 */
export function highlightDrivers(
  text: string,
  names: string[],
  className: string
): React.ReactNode {
  if (!names.length) return text;

  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (names.some((n) => n.toLowerCase() === part.toLowerCase())) {
      return (
        <mark key={i} className={className}>
          {part}
        </mark>
      );
    }
    return part;
  });
}
