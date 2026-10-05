"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { useWatchHistory } from "@/hooks/useWatchHistory";
import { buildWatchProgress } from "@/lib/progress";
import {
  trackPlayerError,
  trackWatchComplete,
  trackWatchStart,
  trackWatchStop,
} from "@/lib/telemetry";

interface VidfastPlayerProps {
  tmdbId: number;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  startAt?: number;
  server?: number;
  onComplete?: (duration: number, currentTime: number) => void;
  onStall?: (currentTime: number, duration: number) => void;
}

interface PlayerMessage {
  type?: string;
  data?: {
    event?: string;
    currentTime?: number;
    duration?: number;
  };
}

const SAVE_THROTTLE_MS = 5000;
const AUTO_NEXT_THRESHOLD = 0.92;
const STALL_THRESHOLD_MS = 8000;
const STALL_POLL_MS = 2500;

function VidfastPlayer({
  tmdbId,
  type,
  season,
  episode,
  startAt,
  server = 1,
  onComplete,
  onStall,
}: VidfastPlayerProps) {
  const lastSaveRef = useRef(0);
  const endNotifiedRef = useRef(false);
  const lastProgressRef = useRef<{
    currentTime: number;
    duration: number;
  } | null>(null);
  const lastAdvanceAtRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastDurationRef = useRef(0);
  const playingRef = useRef(false);
  const stallFiredRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const { saveProgress } = useWatchHistory();
  const { prefs } = useAppPreferences();

  const telemetryRef = useRef({
    sessionStart: 0,
    lastCurrentTime: 0,
    lastDuration: 0,
    started: false,
  });

  useEffect(() => {
    telemetryRef.current = {
      sessionStart: Date.now(),
      lastCurrentTime: 0,
      lastDuration: 0,
      started: true,
    };

    trackWatchStart({
      type,
      tmdbId,
      season: type === "tv" ? season : undefined,
      episode: type === "tv" ? episode : undefined,
    });

    return () => {
      const telemetry = telemetryRef.current;

      if (!telemetry.started) return;

      const seconds =
        telemetry.lastCurrentTime > 0
          ? telemetry.lastCurrentTime
          : (Date.now() - telemetry.sessionStart) / 1000;
      const percentage =
        telemetry.lastDuration > 0
          ? (telemetry.lastCurrentTime / telemetry.lastDuration) * 100
          : 0;

      trackWatchStop(
        {
          type,
          tmdbId,
          season: type === "tv" ? season : undefined,
          episode: type === "tv" ? episode : undefined,
        },
        Math.round(seconds),
        Math.round(percentage)
      );
    };
  }, [episode, season, tmdbId, type]);

  const applyPreferences = useCallback(
    (volume: number, speed: number) => {
      const window_ = iframeRef.current?.contentWindow;
      if (!window_) return;

      try {
        if (volume !== 1) {
          window_.postMessage({ command: "volume", level: volume }, "*");
        }

        if (speed !== 1) {
          window_.postMessage({ command: "speed", value: speed }, "*");
        }
      } catch {
        // Ignore player messaging failures.
      }
    },
    []
  );

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as PlayerMessage;

      if (data?.type !== "PLAYER_EVENT") return;

      const { event: playerEvent, currentTime, duration } = data.data ?? {};

      if (playerEvent === "play") {
        playingRef.current = true;
        stallFiredRef.current = false;
        lastAdvanceAtRef.current = Date.now();
        return;
      }

      if (playerEvent === "pause") {
        playingRef.current = false;
        return;
      }

      if (playerEvent !== "timeupdate" || typeof currentTime !== "number") {
        return;
      }

      lastProgressRef.current = {
        currentTime,
        duration: duration ?? 0,
      };

      if (typeof duration === "number" && duration > 0) {
        lastDurationRef.current = duration;
      }

      if (Math.abs(currentTime - lastTimeRef.current) > 0.3) {
        lastTimeRef.current = currentTime;
        lastAdvanceAtRef.current = Date.now();
        if (playingRef.current) stallFiredRef.current = false;
      }

      const now = Date.now();

      if (
        type === "tv" &&
        typeof duration === "number" &&
        duration > 0 &&
        currentTime / duration >= AUTO_NEXT_THRESHOLD &&
        !endNotifiedRef.current
      ) {
        endNotifiedRef.current = true;
        trackWatchComplete({
          type,
          tmdbId,
          season: type === "tv" ? season : undefined,
          episode: type === "tv" ? episode : undefined,
        });
        onComplete?.(duration, currentTime);
      }

      if (now - lastSaveRef.current >= SAVE_THROTTLE_MS) {
        lastSaveRef.current = now;
        telemetryRef.current.lastCurrentTime = currentTime;
        telemetryRef.current.lastDuration = duration ?? 0;

        saveProgress(
          buildWatchProgress({
            tmdbId,
            mediaType: type,
            season: type === "tv" ? season : undefined,
            episode: type === "tv" ? episode : undefined,
            currentTime,
            duration: duration ?? 0,
            updatedAt: now,
          })
        );
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [episode, onComplete, saveProgress, season, tmdbId, type]);

  useEffect(() => {
    endNotifiedRef.current = false;
  }, [episode, season]);

  useEffect(() => {
    lastTimeRef.current = 0;
    lastDurationRef.current = 0;
    lastAdvanceAtRef.current = Date.now();
    playingRef.current = false;
    stallFiredRef.current = false;
  }, [season, episode, startAt, server, tmdbId, type]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (
        playingRef.current &&
        !stallFiredRef.current &&
        lastDurationRef.current > 0 &&
        Date.now() - lastAdvanceAtRef.current >= STALL_THRESHOLD_MS
      ) {
        stallFiredRef.current = true;
        trackPlayerError({ type, tmdbId }, `stalled at ${lastTimeRef.current.toFixed(0)}s`);
        onStall?.(lastTimeRef.current, lastDurationRef.current);
      }
    }, STALL_POLL_MS);

    return () => {
      window.clearInterval(poll);
    };
  }, [onStall, tmdbId, type]);

  useEffect(() => {
    return () => {
      const last = lastProgressRef.current;
      if (!last) return;

      saveProgress(
        buildWatchProgress({
          tmdbId,
          mediaType: type,
          season: type === "tv" ? season : undefined,
          episode: type === "tv" ? episode : undefined,
          currentTime: last.currentTime,
          duration: last.duration,
          updatedAt: Date.now(),
        })
      );
    };
  }, [episode, saveProgress, season, tmdbId, type]);

  const iframeSrc = useMemo(() => {
    const baseUrl =
      type === "movie"
        ? `https://vidfast.pro/movie/${tmdbId}`
        : `https://vidfast.pro/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`;

    const startAtParam = startAt && startAt > 0 ? `&startAt=${startAt}` : "";

    return `${baseUrl}?title=false&theme=F5F5F5&autoNext=false&next=false&markers=false&server=${server}${startAtParam}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode, season, server, tmdbId, type]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        width="100%"
        height="100%"
        frameBorder="0"
        allowFullScreen
        title="Vidfast Player"
        className="absolute inset-0 h-full w-full"
        onLoad={() => applyPreferences(prefs.defaultVolume, prefs.playbackSpeed)}
      />
    </div>
  );
}

export default memo(VidfastPlayer);