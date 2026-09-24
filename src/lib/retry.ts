interface BackoffOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export async function withBackoff<T>(
  request: () => Promise<T>,
  {
    retries = 2,
    baseDelayMs = 400,
    maxDelayMs = 2500,
  }: BackoffOptions = {}
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await request();
    } catch (error) {
      lastError = error;

      if (attempt === retries) break;

      const delay = Math.min(
        baseDelayMs * 2 ** attempt + Math.random() * 200,
        maxDelayMs
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}