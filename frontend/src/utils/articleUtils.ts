import type { ArticleType } from "../hooks/useArticles";

export function articleTypeLabel(type: ArticleType): string {
  switch (type) {
    case "RECAP": return "Race Recap";
    case "PREVIEW": return "Race Preview";
    case "SEASON_RECAP": return "Season Review";
    case "SEASON_PREVIEW": return "Season Preview";
    case "POWER_RANKINGS": return "Power Rankings";
    case "SESSION": return "Session Report";
  }
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
