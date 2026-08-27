/**
 * "C. Reynolds". The league has more than one driver per surname (two
 * Reynolds), so anywhere a name is shortened for space it still needs the
 * first initial to stay unambiguous.
 */
export function shortDriverName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (f && l) return `${f[0]}. ${l}`;
  return l || f;
}
