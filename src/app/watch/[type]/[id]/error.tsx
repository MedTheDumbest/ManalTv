"use client";

import BoundaryError from "@/components/BoundaryError";

export default function WatchError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BoundaryError reset={reset} title="Player failed to load" />;
}