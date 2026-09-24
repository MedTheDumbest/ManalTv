"use client";

import Link from "next/link";
import type { MediaType } from "@/types";

interface TitlePlayButtonProps {
  tmdbId: number;
  type: MediaType;
}

export default function TitlePlayButton({
  tmdbId,
  type,
}: TitlePlayButtonProps) {
  return (
    <Link
      href={`/watch/${type}/${tmdbId}`}
      className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-transform duration-300 hover:scale-105 hover:bg-zinc-200"
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M8 5v14l11-7z" />
      </svg>
      Play Video
    </Link>
  );
}