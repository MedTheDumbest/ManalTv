"use client";

import BoundaryError from "@/components/BoundaryError";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BoundaryError reset={reset} />;
}