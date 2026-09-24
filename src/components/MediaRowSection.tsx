"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface MediaRowSectionProps {
  title: string;
  headerAction?: ReactNode;
  children: ReactNode;
}

export default function MediaRowSection({
  title,
  headerAction,
  children,
}: MediaRowSectionProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const timer = window.setTimeout(updateArrows, 0);
    el.addEventListener("scroll", updateArrows, { passive: true });

    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", updateArrows);
    };
  }, [updateArrows]);

  const scrollRow = useCallback((direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }, []);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4 px-4 md:px-8">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {headerAction}
      </div>
      <div className="group relative">
        <button
          type="button"
          onClick={() => scrollRow(-1)}
          aria-label={`Scroll ${title} left`}
          className={`absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-card/90 text-primary backdrop-blur-md transition-opacity duration-300 hover:bg-hover focus-visible:outline-none md:flex ${
            canLeft
              ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div
          ref={scrollerRef}
          role="region"
          aria-label={title}
          tabIndex={0}
          className="scrollbar-hide flex gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 snap-x snap-mandatory focus-visible:outline-none md:px-8 md:scroll-px-8"
        >
          {children}
        </div>

        <button
          type="button"
          onClick={() => scrollRow(1)}
          aria-label={`Scroll ${title} right`}
          className={`absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-card/90 text-primary backdrop-blur-md transition-opacity duration-300 hover:bg-hover focus-visible:outline-none md:flex ${
            canRight
              ? "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
            className="h-5 w-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}