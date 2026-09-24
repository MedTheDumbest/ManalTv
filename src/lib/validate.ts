export function parsePositiveInt(value: string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseEnum<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T | null {
  if (!value) return null;

  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function parsePage(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("page"));

  return Number.isInteger(raw) && raw >= 1 && raw <= 500 ? raw : 1;
}