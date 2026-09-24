export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

export function mediaKey(type: "movie" | "tv", id: number): string {
  return `${type}-${id}`;
}