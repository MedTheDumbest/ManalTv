"use client";

import { useCallback, useEffect, useState } from "react";

interface TrailerBlockProps {
  trailerKey: string;
}

const YOUTUBE_NOCOOKIE_URL = "https://www.youtube-nocookie.com/embed/";

export default function TrailerBlock({ trailerKey }: TrailerBlockProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition-colors duration-300 hover:border-white/40 hover:bg-white/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
        Watch Trailer
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Trailer"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050505]/90 p-4 backdrop-blur-xl"
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close trailer"
            className="absolute right-6 top-6 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white backdrop-blur-xl transition-colors hover:bg-black/60"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div
            className="w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <iframe
              src={`${YOUTUBE_NOCOOKIE_URL}${trailerKey}?autoplay=1&modestbranding=1&rel=0&iv_load_policy=3&showinfo=0&controls=1`}
              title="Trailer"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="aspect-video w-full max-w-5xl rounded-2xl border-0 shadow-2xl"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}