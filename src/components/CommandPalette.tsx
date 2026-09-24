"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { searchMedia } from "@/lib/tmdb";
import type { MediaItem } from "@/types";

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

interface SearchState {
  query: string;
  items: MediaItem[];
}

interface CommandPaletteProps {
  onClose: () => void;
  onLogout?: () => void;
}

export default function CommandPalette({
  onClose,
  onLogout,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();

    if (!trimmed) return;

    let cancelled = false;

    searchMedia(trimmed)
      .then((items) => {
        if (!cancelled) {
          setState({ query: trimmed, items: items.slice(0, MAX_RESULTS) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ query: trimmed, items: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0 && state?.query !== trimmedQuery;
  const results = state && state.query === trimmedQuery ? state.items : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex justify-center bg-black/60 pt-[20vh] backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="flex h-fit w-[95%] flex-col overflow-hidden rounded-xl bg-card shadow-2xl backdrop-blur-xl md:w-[600px]"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onClose();
          }}
          placeholder="Search movies & TV…"
          aria-label="Search movies and TV"
          className="w-full rounded-xl bg-card p-4 text-lg text-white outline-none ring-0 placeholder-zinc-500 md:p-6 md:text-2xl"
        />

        <div className="max-h-[45vh] overflow-y-auto border-t border-white/8 p-2">
          {trimmedQuery.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Type to search across movies & TV.
            </p>
          ) : searching ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No results found for “{trimmedQuery}”.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {results.map((item) => (
                <li key={`${item.type}-${item.id}`}>
                  <Link
                    href={`/title/${item.type}/${item.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none"
                  >
                    <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-card">
                      {item.posterPath ? (
                        <Image
                          src={item.posterPath}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {item.title}
                      </span>
                      <span className="block text-[11px] uppercase tracking-wider text-muted">
                        {item.type} · {item.year ?? "Unknown year"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {onLogout ? (
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5">
            <span className="text-xs text-muted">
              Press <kbd className="rounded border border-white/10 px-1 text-[10px]">/</kbd> or{" "}
              <kbd className="rounded border border-white/10 px-1 text-[10px]">R</kbd> to jump
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M10 17l5-5-5-5" />
                <path d="M15 12H3" />
                <path d="M20 5v14" />
              </svg>
              Switch profile
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}