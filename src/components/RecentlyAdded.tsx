"use client";

import { useEffect, useState } from "react";
import MediaRow from "@/components/MediaRow";
import { RowSkeleton } from "@/components/RowSkeleton";
import { useAppPreferences } from "@/hooks/useAppPreferences";
import { getRecentlyReleased } from "@/lib/tmdb";
import type { MediaItem, MediaType } from "@/types";

const MAX_ITEMS = 18;

type RecentState =
  | { tab: MediaType; status: "ok"; items: MediaItem[] }
  | { tab: MediaType; status: "error" };

export default function RecentlyAdded() {
  const { prefs } = useAppPreferences();
  const [recent, setRecent] = useState<RecentState | null>(null);

  useEffect(() => {
    let cancelled = false;

    getRecentlyReleased(prefs.lastActiveTab)
      .then((items) => {
        if (!cancelled) {
          setRecent({ tab: prefs.lastActiveTab, status: "ok", items });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecent({ tab: prefs.lastActiveTab, status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [prefs.lastActiveTab]);

  if (recent !== null && recent.tab === prefs.lastActiveTab) {
    if (recent.status === "error" || recent.items.length === 0) return null;

    const cleanItems = recent.items.filter(
      (item) => item.posterPath !== "" && item.backdropPath !== ""
    );

    if (cleanItems.length === 0) return null;

    return (
      <MediaRow
        title="Recently Added"
        items={cleanItems.slice(0, MAX_ITEMS)}
        showNewBadge
      />
    );
  }

  return <RowSkeleton />;
}