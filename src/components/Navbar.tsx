"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import CommandPalette from "@/components/CommandPalette";
import Logo from "@/components/Logo";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { useWatchlist } from "@/hooks/useWatchlist";
import { resetRemoteStores } from "@/lib/remote-stores";
import { trackSurprisePick } from "@/lib/telemetry";
import { watchKey } from "@/lib/progress";
import type { MediaType } from "@/types";

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function DiceIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

type SurpriseOption = "anything" | "movie" | "tv" | "unwatched";

interface SurpriseCandidate {
  mediaType: MediaType;
  tmdbId: number;
}

const SURPRISE_OPTIONS: { value: SurpriseOption; label: string }[] = [
  { value: "anything", label: "Anything" },
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
  { value: "unwatched", label: "Unwatched" },
];

function pickRandomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const surpriseRef = useRef<HTMLDivElement | null>(null);
  const { prefs, setLastActiveTab } = useAppPreferences();
  const { items: watchlist } = useWatchlist();
  const { history } = useWatchHistory();

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // Ignore logout network failures.
    }
    resetRemoteStores();
    router.push("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const node = surpriseRef.current;
      if (!node || !node.contains(event.target as Node)) setSurpriseOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const buildPool = useCallback(
    (option: SurpriseOption): SurpriseCandidate[] => {
      const watchlistCandidates: SurpriseCandidate[] = watchlist.map(
        (entry) => ({ mediaType: entry.mediaType, tmdbId: entry.tmdbId })
      );
      const historyCandidates: SurpriseCandidate[] = history.map((entry) => ({
        mediaType: entry.mediaType,
        tmdbId: entry.tmdbId,
      }));

      const seen = new Set<string>();
      const pool: SurpriseCandidate[] = [];

      for (const candidate of [
        ...watchlistCandidates,
        ...historyCandidates,
      ]) {
        if (option === "movie" && candidate.mediaType !== "movie") continue;
        if (option === "tv" && candidate.mediaType !== "tv") continue;

        const key = watchKey(candidate.mediaType, candidate.tmdbId);
        if (seen.has(key)) continue;
        seen.add(key);
        pool.push(candidate);
      }

      if (option === "unwatched") {
        const watchedKeys = new Set(
          history
            .filter(
              (entry) =>
                entry.currentTime > 0 ||
                (entry.percentageWatched ?? 0) > 0
            )
            .map((entry) => watchKey(entry.mediaType, entry.tmdbId))
        );

        return pool.filter(
          (candidate) => !watchedKeys.has(watchKey(candidate.mediaType, candidate.tmdbId))
        );
      }

      return pool;
    },
    [history, watchlist]
  );

  const handleSurprise = useCallback(
    (option: SurpriseOption) => {
      const pool = buildPool(option);

      setSurpriseOpen(false);

      if (pool.length === 0) return;

      const pick = pool[pickRandomIndex(pool.length)];
      if (!pick) return;

      trackSurprisePick({ type: pick.mediaType, tmdbId: pick.tmdbId });
      router.push(`/watch/${pick.mediaType}/${pick.tmdbId}`);
    },
    [buildPool, router]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setSurpriseOpen(false);
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        Boolean(target?.isContentEditable);

      if (isEditable || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        handleSurprise("anything");
        return;
      }

      if (event.key !== "/") return;

      event.preventDefault();
      setPaletteOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSurprise]);

  if (pathname.startsWith("/watch") || pathname.startsWith("/title")) {
    return null;
  }

  return (
    <header
      className={`fixed top-0 z-50 w-full border-b border-white/8 backdrop-blur-xl transition-colors duration-300 ${
        scrolled ? "bg-surface/90" : "bg-surface/40"
      }`}
    >
      <nav className="flex w-full items-center justify-between gap-2 px-4 py-3 sm:px-8">
        <Link
          href="/"
          className="transition-opacity hover:opacity-90"
        >
          <Logo size="lg" />
        </Link>

        <div className="hidden items-center justify-center gap-6 md:flex">
          {(
            [
              ["movie", "Movies"],
              ["tv", "TV Shows"],
            ] as const
          ).map(([tab, label]) => {
            const active = prefs.lastActiveTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setLastActiveTab(tab)}
                className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                  active
                    ? "border-white text-primary"
                    : "border-transparent text-muted hover:border-white/20 hover:text-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground transition-colors hover:bg-white/10"
          >
            <SearchIcon className="h-5 w-5" />
            <span className="hidden text-muted group-hover:text-foreground md:inline">
              Search
            </span>
            <kbd className="hidden rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-muted md:inline">
              /
            </kbd>
          </button>

          <div ref={surpriseRef} className="relative">
            <button
              type="button"
              onClick={() => setSurpriseOpen((current) => !current)}
              aria-haspopup="menu"
              aria-expanded={surpriseOpen}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r from-red-600/20 to-purple-600/20 px-4 py-2 text-sm text-white transition-colors hover:from-red-600/40 hover:to-purple-600/40"
            >
              <DiceIcon className="h-5 w-5" />
              <span className="hidden text-sm md:inline">
                Surprise Me <span className="text-white/70">· R</span>
              </span>
            </button>

            {surpriseOpen ? (
              <div
                role="menu"
                aria-label="Surprise me"
                className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-white/8 bg-card/80 p-1 shadow-2xl backdrop-blur-xl"
              >
                {SURPRISE_OPTIONS.map((option) => {
                  const empty = buildPool(option.value).length === 0;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitem"
                      disabled={empty}
                      onClick={() => handleSurprise(option.value)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        empty
                          ? "cursor-not-allowed text-muted"
                          : "text-foreground hover:bg-white/10"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </nav>

      {paletteOpen ? (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}
    </header>
  );
}