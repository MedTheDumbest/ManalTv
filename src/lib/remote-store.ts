export interface RemoteStore<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
  ensureLoaded(): Promise<T>;
  refresh(): Promise<void>;
  mutate(update: (current: T) => T): void;
  replace(value: T): void;
  reset(): void;
}

type Listener = () => void;

export function createRemoteStore<T>(
  fallback: T,
  load: () => Promise<T>
): RemoteStore<T> {
  let cache: T | null = null;
  let loadPromise: Promise<T> | null = null;
  let refreshPromise: Promise<void> | null = null;
  let generation = 0;
  const listeners = new Set<Listener>();

  function notify() {
    for (const listener of listeners) {
      listener();
    }
  }

  function getSnapshot(): T {
    return cache ?? fallback;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  async function ensureLoaded(): Promise<T> {
    if (cache !== null) return Promise.resolve(cache);
    if (loadPromise) return loadPromise;

    const myGeneration = generation;

    loadPromise = load()
      .catch(() => fallback)
      .then((value) => {
        if (myGeneration === generation) {
          cache = value;
          notify();
        }
        return value;
      })
      .finally(() => {
        loadPromise = null;
      });

    return loadPromise;
  }

  async function refresh(): Promise<void> {
    if (refreshPromise) return refreshPromise;

    const myGeneration = generation;

    refreshPromise = load()
      .then((value) => {
        if (myGeneration === generation) {
          cache = value;
          notify();
        }
      })
      .catch(() => {})
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function mutate(update: (current: T) => T) {
    cache = update(getSnapshot());
    notify();
  }

  function replace(value: T) {
    cache = value;
    notify();
  }

  function reset() {
    generation += 1;
    cache = null;
    loadPromise = null;
    refreshPromise = null;
    notify();
  }

  return {
    getSnapshot,
    subscribe,
    ensureLoaded,
    refresh,
    mutate,
    replace,
    reset,
  };
}