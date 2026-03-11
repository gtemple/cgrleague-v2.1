export function articleTypeLabel(type: "RECAP" | "PREVIEW"): string {
  return type === "RECAP" ? "Race Recap" : "Race Preview";
}

export function formatArticleDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatArticleDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
