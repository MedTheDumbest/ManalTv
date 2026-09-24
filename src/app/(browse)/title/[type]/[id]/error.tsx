"use client";

import BoundaryError from "@/components/BoundaryError";

export default function TitleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BoundaryError reset={reset} title="Title failed to load" />;
}