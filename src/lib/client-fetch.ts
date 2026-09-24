export async function jsonFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error("Network request failed");
  }

  if (res.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  return (await res.json()) as T;
}