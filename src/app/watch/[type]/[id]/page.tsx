"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import VidfastPlayer from "@/components/VidfastPlayer";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { getSeasonEpisodes, getTvDetails } from "@/lib/tmdb";
import { withBackoff } from "@/lib/retry";
import { buildWatchProgress } from "@/lib/progress";
import { trackDrawerOpen, trackSeasonSwitch } from "@/lib/telemetry";
import type { TvEpisode, TvShowDetails } from "@/lib/tmdb";
import type { MediaType, WatchQueueItem } from "@/types";

const CHROME_HIDE_DELAY_MS = 3000;
const NEXT_EPISODE_DELAY_MS = 5000;

export default function WatchPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-black" />}>
      <WatchPlayer />
    </Suspense>
  );
}

function WatchPlayer() {
  const params = useParams<{ type: string; id: string }>();

  if (params.type !== "movie" && params.type !== "tv") notFound();

  const mediaType: MediaType = params.type;
  const tmdbId = Number(params.id);

  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [chromeVisible, setChromeVisible] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const chromeTimer = useRef<number | undefined>(undefined);
  const chromeFrame = useRef<number | undefined>(undefined);
  const { history, saveProgress, advanceToNextEpisode } = useWatchHistory();
  const { prefs, update } = useAppPreferences();

  const [tvDetails, setTvDetails] = useState<TvShowDetails | null>(null);
  const [episodes, setEpisodes] = useState<TvEpisode[]>([]);
  const [tvError, setTvError] = useState(false);
  const [episodesError, setEpisodesError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const seasonMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [startAtTime, setStartAtTime] = useState<number>(0);
  const [pendingNext, setPendingNext] = useState<TvEpisode | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [resumeKey, setResumeKey] = useState(0);
  const countdownTimerRef = useRef<number | undefined>(undefined);
  const stallPointRef = useRef<{ currentTime: number; duration: number } | null>(null);
  const seededRef = useRef(false);
  const interactedRef = useRef(false);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const node = seasonMenuRef.current;
      if (node && !node.contains(event.target as Node)) {
        setSeasonMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const retry = () => {
    setTvError(false);
    setEpisodesError(false);
    setReloadKey((key) => key + 1);
  };

  const showChrome = useCallback(() => {
    setChromeVisible(true);

    if (chromeTimer.current !== undefined) {
      window.clearTimeout(chromeTimer.current);
    }

    chromeTimer.current = window.setTimeout(
      () => setChromeVisible(false),
      CHROME_HIDE_DELAY_MS
    );
  }, []);

  const scheduleShowChrome = () => {
    if (chromeFrame.current !== undefined) return;

    chromeFrame.current = window.requestAnimationFrame(() => {
      chromeFrame.current = undefined;
      showChrome();
    });
  };

  const nextEpisode = episodes.find(
    (episode) => episode.episodeNumber === selectedEpisode + 1
  );

const startNextEpisode = useCallback(
    (episodeNumber: number) => {
      setPendingNext(null);
      setCountdown(0);
      setSelectedEpisode(episodeNumber);
      setStartAtTime(0);
      setChromeVisible(true);
      interactedRef.current = true;

      advanceToNextEpisode(
        { tmdbId, mediaType, season: selectedSeason },
        episodeNumber
      );

      if (prefs.playNextAuto) {
        const queuedItem: WatchQueueItem = {
          tmdbId,
          mediaType: "tv",
          season: selectedSeason,
          episode: episodeNumber,
          title: tvDetails?.title ?? "",
          updatedAt: Date.now(),
        };

        update({
          watchQueue: [
            queuedItem,
            ...prefs.watchQueue.filter(
              (entry) =>
                !(
                  entry.tmdbId === tmdbId &&
                  entry.mediaType === "tv" &&
                  entry.season === selectedSeason &&
                  entry.episode === episodeNumber
                )
            ),
          ].slice(0, 200),
        });
      }
    },
    [
      advanceToNextEpisode,
      mediaType,
      prefs.playNextAuto,
      prefs.watchQueue,
      selectedSeason,
      tmdbId,
      tvDetails?.title,
      update,
    ]
  );

  const handleComplete = useCallback(
    (duration: number) => {
      if (mediaType !== "tv") return;

      if (!nextEpisode) {
        setPendingNext(null);
        setCountdown(0);

        if (duration > 0) {
          saveProgress(
            buildWatchProgress({
              tmdbId,
              mediaType: "tv",
              season: selectedSeason,
              episode: selectedEpisode,
              currentTime: duration,
              duration,
              updatedAt: Date.now(),
            })
          );
        }

        return;
      }

      if (prefs.playNextAuto) {
        startNextEpisode(nextEpisode.episodeNumber);
        return;
      }

      setPendingNext(nextEpisode);
      setCountdown(0);
    },
    [
      mediaType,
      nextEpisode,
      prefs.playNextAuto,
      saveProgress,
      selectedEpisode,
      selectedSeason,
      startNextEpisode,
      tmdbId,
    ]
  );

  const cancelNext = useCallback(() => {
    setPendingNext(null);
    setCountdown(0);
    setChromeVisible(true);
  }, []);

  const handleStall = useCallback((currentTime: number, duration: number) => {
    stallPointRef.current = { currentTime, duration };
    setStalled(true);
  }, []);

  const handleResume = useCallback(() => {
    const point = stallPointRef.current;
    let resumeAt = startAtTime + 5;

    if (point && point.currentTime > 0 && point.duration > 0) {
      resumeAt = Math.min(
        point.currentTime + 5,
        Math.max(point.duration - 10, point.currentTime + 1)
      );
    }

    setStartAtTime(resumeAt);
    setStalled(false);
    setResumeKey((key) => key + 1);
    interactedRef.current = true;
  }, [startAtTime]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      seededRef.current = false;
      interactedRef.current = false;
      setSelectedSeason(1);
      setSelectedEpisode(1);
      setStartAtTime(0);
      setPendingNext(null);
      setCountdown(0);
      setStalled(false);
      setResumeKey(0);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [mediaType, tmdbId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (seededRef.current || interactedRef.current) return;

      const entry = history.find(
        (progress) =>
          progress.tmdbId === tmdbId && progress.mediaType === mediaType
      );

      if (!entry) return;

      seededRef.current = true;

      if (typeof entry.season === "number") {
        setSelectedSeason(entry.season);
      }
      if (typeof entry.episode === "number") {
        setSelectedEpisode(entry.episode);
      }
      setStartAtTime(entry.currentTime > 0 ? entry.currentTime : 0);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [history, mediaType, tmdbId]);

  useEffect(() => {
    if (!pendingNext || !prefs.playNextAuto) return;

    countdownTimerRef.current = window.setInterval(() => {
      setCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    const fireRef = window.setTimeout(() => {
      startNextEpisode(pendingNext.episodeNumber);
    }, NEXT_EPISODE_DELAY_MS);

    return () => {
      if (countdownTimerRef.current !== undefined) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = undefined;
      }
      window.clearTimeout(fireRef);
    };
  }, [pendingNext, prefs.playNextAuto, startNextEpisode]);

  useEffect(() => {
    if (mediaType !== "tv") return;

    let cancelled = false;

    withBackoff(() => getTvDetails(tmdbId))
      .then((details) => {
        if (!cancelled) setTvDetails(details);
      })
      .catch(() => {
        if (!cancelled) setTvError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaType, reloadKey, tmdbId]);

  useEffect(() => {
    if (mediaType !== "tv") return;

    let cancelled = false;

    withBackoff(() => getSeasonEpisodes(tmdbId, selectedSeason))
      .then((seasonEpisodes) => {
        if (!cancelled) setEpisodes(seasonEpisodes);
      })
      .catch(() => {
        if (!cancelled) setEpisodesError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaType, reloadKey, selectedSeason, tmdbId]);

  useEffect(() => {
    return () => {
      if (chromeTimer.current !== undefined) {
        window.clearTimeout(chromeTimer.current);
      }

      if (chromeFrame.current !== undefined) {
        window.cancelAnimationFrame(chromeFrame.current);
      }
    };
  }, []);

  const handleSelectSeason = (seasonNumber: number) => {
    interactedRef.current = true;
    trackSeasonSwitch(seasonNumber);
    setSelectedSeason(seasonNumber);
    setSelectedEpisode(1);
    setStartAtTime(0);
    setEpisodesError(false);
  };

  const handleSelectEpisode = (episodeNumber: number) => {
    interactedRef.current = true;
    setSelectedEpisode(episodeNumber);
    setStartAtTime(0);
  };

  const showDescription = (episodeNumber: number) => {
    setExpandedIds((current) => {
      if (current.has(episodeNumber)) return current;

      const next = new Set(current);
      next.add(episodeNumber);
      return next;
    });
  };

  const hideDescription = (episodeNumber: number) => {
    setExpandedIds((current) => {
      if (!current.has(episodeNumber)) return current;

      const next = new Set(current);
      next.delete(episodeNumber);
      return next;
    });
  };

  const toggleDescription = (episodeNumber: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(episodeNumber)) {
        next.delete(episodeNumber);
      } else {
        next.add(episodeNumber);
      }

      return next;
    });
  };

  return (
    <main
      className="relative h-[100dvh] w-screen overflow-hidden bg-black"
      onMouseMove={scheduleShowChrome}
      onTouchStart={scheduleShowChrome}
    >
      {isClient ? (
        <div className="absolute inset-0">
          <VidfastPlayer
            key={`${tmdbId}:${resumeKey}`}
            tmdbId={tmdbId}
            type={mediaType}
            season={mediaType === "tv" ? selectedSeason : undefined}
            episode={mediaType === "tv" ? selectedEpisode : undefined}
            startAt={startAtTime}
            onComplete={handleComplete}
            onStall={handleStall}
          />
        </div>
      ) : null}

      {pendingNext ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Next episode"
          className="absolute inset-0 z-[45] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="flex w-[320px] flex-col items-center gap-4 rounded-2xl border border-white/8 bg-surface/90 p-6 text-center shadow-2xl backdrop-blur-xl">
            {countdown > 0 ? (
              <>
                <p className="text-sm text-muted">Next episode starts in</p>
                <p className="text-5xl font-bold tabular-nums text-primary">
                  {countdown}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Up next</p>
            )}
            <p className="min-h-[1.25rem] text-sm font-medium text-foreground">
              {pendingNext.name
                ? `E${pendingNext.episodeNumber} ${pendingNext.name}`
                : `Episode ${pendingNext.episodeNumber}`}
            </p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={() =>
                  startNextEpisode(pendingNext.episodeNumber)
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play Now
              </button>
              <button
                type="button"
                onClick={cancelNext}
                className="flex-1 rounded-full border border-white/8 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {stalled ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Playback stopped"
          className="absolute inset-0 z-[45] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <div className="flex w-[320px] flex-col items-center gap-4 rounded-2xl border border-white/8 bg-surface/90 p-6 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold text-primary">
              Playback stopped
            </p>
            <p className="text-sm text-muted">
              The stream stalled. Resume from where you left off.
            </p>
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={handleResume}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                Resume
              </button>
              <button
                type="button"
                onClick={() => setStalled(false)}
                className="flex-1 rounded-full border border-white/8 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-hover"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDrawerOpen ? (
        <div
          aria-hidden="true"
          onClick={() => setIsDrawerOpen(false)}
          className="absolute inset-0 z-40 bg-black/40"
        />
      ) : null}

      <div
        className={`pointer-events-none absolute inset-0 z-50 transition-opacity duration-500 motion-reduce:transition-none ${
          chromeVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute left-0 top-0 flex w-full items-start justify-between bg-linear-to-b from-black/80 to-transparent p-6">
          <Link
            href="/"
            aria-label="Back to home"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 p-3 text-white backdrop-blur-xl transition hover:bg-white/20"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>

          {mediaType === "tv" ? (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Show episodes"
              className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl transition hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {mediaType === "tv" && !isDrawerOpen ? (
        <button
          type="button"
          onClick={() => {
            trackDrawerOpen(selectedSeason, episodes.length);
            setIsDrawerOpen(true);
          }}
          aria-label="Show episodes"
          className="absolute right-6 top-6 z-50 flex items-center gap-2 rounded-full border border-white/8 bg-black/40 p-3 text-white backdrop-blur-xl transition-all hover:bg-black/60"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span className="pr-1 text-sm font-medium">Episodes</span>
        </button>
      ) : null}

      {mediaType === "tv" ? (
        <aside
          role="complementary"
          aria-label="Episodes"
          className={`absolute right-0 top-0 z-[60] flex h-full w-full flex-col border-l border-white/8 bg-black/90 backdrop-blur-3xl transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none sm:w-[380px] sm:bg-black/30 ${
            isDrawerOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex shrink-0 flex-col gap-2 border-b border-white/8 p-5">
            <div className="flex items-start justify-between gap-2">
              <h1 className="truncate text-2xl font-bold text-white">
                {tvDetails?.title ?? "Loading..."}
              </h1>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close episodes"
                className="-mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 p-3 text-white/80 backdrop-blur-xl transition hover:bg-white/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                  className="h-4 w-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div ref={seasonMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setSeasonMenuOpen((current) => !current)}
                  aria-haspopup="listbox"
                  aria-expanded={seasonMenuOpen}
                  disabled={!tvDetails}
                  className="mt-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#111111] px-4 py-3 text-sm font-medium text-white transition-all hover:bg-[#181818] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>Season {selectedSeason}</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={`h-4 w-4 text-white/70 transition-transform duration-200 ${
                      seasonMenuOpen ? "rotate-180" : ""
                    }`}
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {seasonMenuOpen ? (
                  <div
                    role="listbox"
                    aria-label="Seasons"
                    className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#111111] p-1 shadow-2xl"
                  >
                    {(tvDetails?.seasons ?? []).length > 0
                      ? tvDetails?.seasons.map((season) => {
                          const active =
                            season.seasonNumber === selectedSeason;

                          return (
                            <button
                              key={season.seasonNumber}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => {
                                handleSelectSeason(season.seasonNumber);
                                setSeasonMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                active
                                  ? "bg-white/10 font-semibold text-white"
                                  : "text-white/80 hover:bg-white/5 hover:text-white"
                              }`}
                            >
                              Season {season.seasonNumber}
                              {active ? (
                                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-red-600" />
                              ) : null}
                            </button>
                          );
                        })
                      : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted">
                  {episodes.length} Episodes
                </span>
                {tvError ? (
                  <button
                    type="button"
                    onClick={retry}
                    className="text-left text-xs font-medium text-red-400 underline-offset-2 hover:underline"
                  >
                    Failed to load details. Retry.
                  </button>
                ) : null}
              </div>
          </div>

          <div className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 overflow-y-auto">
            {episodesError && episodes.length === 0 ? (
              <div className="flex flex-col items-start gap-2 p-5">
                <span className="text-sm text-muted">
                  Failed to load episodes.
                </span>
                <button
                  type="button"
                  onClick={retry}
                  className="text-xs font-medium text-red-400 underline-offset-2 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : episodes.length === 0 && !episodesError ? (
              <div className="space-y-3 p-3">
                {[0, 1, 2, 3, 4].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="flex h-[70px] items-center gap-4 rounded-md p-3"
                  >
                    <div className="h-[56px] w-[100px] shrink-0 animate-pulse rounded-md bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              episodes.map((episode) => {
                const isSelected =
                  selectedEpisode === episode.episodeNumber;
                const expanded = expandedIds.has(episode.episodeNumber);
                const entry = history.find(
                  (item) =>
                    item.tmdbId === tmdbId &&
                    item.mediaType === "tv" &&
                    item.season === selectedSeason &&
                    item.episode === episode.episodeNumber
                );
                const progress =
                  entry && entry.duration > 0
                    ? Math.min(
                        100,
                        (entry.currentTime / entry.duration) * 100
                      )
                    : 0;

                return (
                  <div
                    key={episode.episodeNumber}
                    onMouseEnter={() =>
                      showDescription(episode.episodeNumber)
                    }
                    onMouseLeave={() =>
                      hideDescription(episode.episodeNumber)
                    }
                    className={`group flex flex-col border-b border-white/8 p-3 transition-colors duration-300 ${
                      isSelected
                        ? "border-l-4 border-l-red-600 bg-[#111111]"
                        : "cursor-pointer hover:bg-white/5"
                    }`}
                  >
                    <div className="flex h-[70px] items-center gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectEpisode(episode.episodeNumber)
                        }
                        aria-label={`Play episode ${episode.episodeNumber}`}
                        className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-4 text-left"
                      >
                        <span className="relative h-[56px] w-[100px] shrink-0 overflow-hidden rounded-md bg-white/5">
                          {episode.stillPath ? (
                            <Image
                              src={episode.stillPath}
                              alt=""
                              fill
                              sizes="100px"
                              className="object-cover"
                            />
                          ) : null}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                                className="ml-0.5 h-3.5 w-3.5 text-black"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </span>
                        </span>

                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          {isSelected ? (
                            <span className="text-[10px] uppercase tracking-wider text-white/70">
                              Now Playing
                            </span>
                          ) : null}
                          <span className="line-clamp-1 text-sm font-medium text-white">
                            E{episode.episodeNumber}{" "}
                            {episode.name ||
                              `Episode ${episode.episodeNumber}`}
                          </span>
                          {episode.runtime ? (
                            <span className="text-xs text-muted">
                              {episode.runtime} min
                            </span>
                          ) : null}
                        </span>
                      </button>

                      {episode.overview ? (
                        <button
                          type="button"
                          onClick={() =>
                            toggleDescription(episode.episodeNumber)
                          }
                          aria-label="Show episode description"
                          aria-expanded={expanded}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                            className="h-4 w-4"
                          >
                            <circle cx="12" cy="12" r="9" />
                            <path strokeLinecap="round" d="M12 11v5" />
                            <path strokeLinecap="round" d="M12 8h.01" />
                          </svg>
                        </button>
                      ) : null}
                    </div>

                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        expanded
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        {episode.overview ? (
                          <p className="mt-3 line-clamp-3 text-xs text-muted">
                            {episode.overview}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {isSelected && progress > 0 ? (
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-card">
                        <div
                          className="h-full rounded-full bg-red-600 transition-[width] duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-white/8">
            <div className="flex items-center justify-between px-5 py-3">
              <span className="text-xs text-muted">
                Auto-play next episode
              </span>
              <button
                type="button"
                onClick={() =>
                  update({ playNextAuto: !prefs.playNextAuto })
                }
                aria-pressed={prefs.playNextAuto}
                aria-label="Toggle auto-play for the next episode"
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ${
                  prefs.playNextAuto ? "bg-primary" : "bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-1/2 block h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-black transition-[left] duration-300 ${
                    prefs.playNextAuto ? "left-[18px]" : "left-[3px]"
                  }`}
                />
              </button>
            </div>
            {nextEpisode ? (
              <button
                type="button"
                onClick={() =>
                  handleSelectEpisode(nextEpisode.episodeNumber)
                }
                className="flex h-[75px] w-full cursor-pointer items-center justify-between border-t border-white/8 p-4 text-left transition-colors hover:bg-white/10"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-muted">
                    Next Episode
                  </span>
                  <span className="truncate text-sm text-white">
                    E{nextEpisode.episodeNumber} {nextEpisode.name}
                  </span>
                </span>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className="ml-0.5 h-4 w-4 text-white"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </button>
            ) : null}
          </div>
        </aside>
      ) : null}
    </main>
  );
}