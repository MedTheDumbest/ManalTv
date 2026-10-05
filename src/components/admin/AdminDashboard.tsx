"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import type {
  AdminSnapshot,
  DayAggregate,
  StoredEvent,
  TitleAggregate,
} from "@/lib/telemetry-server";

type TabId = "overview" | "viewing" | "intent" | "security" | "data" | "system";

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "viewing", label: "Viewing" },
  { id: "intent", label: "Intent" },
  { id: "security", label: "Security" },
  { id: "data", label: "Data" },
  { id: "system", label: "System" },
];

function formatHours(seconds: number): string {
  if (seconds <= 0) return "0h";
  const hours = seconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(1)}h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatWhen(at: number): string {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relative(at: number): string {
  if (!at) return "never";
  const diff = Date.now() - at;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-card/50 p-4">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="text-2xl font-bold text-white">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

function Sparkline({ series }: { series: DayAggregate[] }) {
  const max = Math.max(1, ...series.map((day) => day.seconds));

  return (
    <div className="flex h-28 items-end gap-[3px]">
      {series.map((day) => (
        <div
          key={day.date}
          title={`${day.date} · ${formatHours(day.seconds)}`}
          className="flex-1 rounded-t bg-red-600/70 transition-colors hover:bg-red-500"
          style={{ height: `${Math.max(2, (day.seconds / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function HourHeatmap({ hours }: { hours: { hour: string; seconds: number }[] }) {
  const max = Math.max(1, ...hours.map((bucket) => bucket.seconds));

  return (
    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12 lg:grid-cols-[repeat(24,minmax(0,1fr))]">
      {hours.map((bucket) => (
        <div
          key={bucket.hour}
          title={`${bucket.hour}:00 · ${formatHours(bucket.seconds)}`}
          className="flex aspect-square items-center justify-center rounded-md text-[9px] text-white/60"
          style={{
            backgroundColor: `rgba(220, 38, 38, ${0.08 + (bucket.seconds / max) * 0.85})`,
          }}
        >
          {Number(bucket.hour) % 6 === 0 ? bucket.hour : ""}
        </div>
      ))}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-muted">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-3 py-6 text-center text-muted">
                No data recorded yet.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={index}
                className="border-b border-white/5 transition-colors hover:bg-white/5"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function EventRow({ event }: { event: StoredEvent }) {
  const detail = Object.entries(event.data)
    .filter(([key]) => key !== "path")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  return (
    <tr className="border-b border-white/5 text-xs transition-colors hover:bg-white/5">
      <td className="whitespace-nowrap px-3 py-2 text-muted">{formatWhen(event.at)}</td>
      <td className="px-3 py-2">
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-white">{event.name}</span>
      </td>
      <td className="px-3 py-2 text-muted">{event.profile ?? "—"}</td>
      <td className="px-3 py-2 text-foreground">{event.device}</td>
      <td className="px-3 py-2 text-muted">{event.country || "—"}</td>
      <td className="max-w-[280px] truncate px-3 py-2 text-muted" title={detail}>
        {detail || "—"}
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/stats", { cache: "no-store" });

      if (response.status === 401) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(`Stats request failed (${response.status})`);
        return;
      }

      setSnapshot((await response.json()) as AdminSnapshot);
      setError(null);
    } catch {
      setError("Network error");
    }
  }, [router]);

  const load = useCallback(async () => {
    setRefreshing(true);

    try {
      await fetchStats();
    } finally {
      setRefreshing(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void fetchStats();
    }, 0);
    const interval = window.setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [fetchStats, load]);

  const logout = useCallback(async () => {
    await fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
    router.replace("/admin/login");
    router.refresh();
  }, [router]);

  const purge = useCallback(async () => {
    if (!window.confirm("Delete every recorded event, rollup and session? This cannot be undone.")) {
      return;
    }

    await fetch("/api/admin/purge", { method: "DELETE" });
    await load();
  }, [load]);

  const titleRows = useMemo<TitleAggregate[]>(() => snapshot?.titles ?? [], [snapshot]);
  const searches = useMemo(() => {
    const list = (snapshot?.events ?? []).filter((event) => event.name === "search");
    return Array.from(
      new Map(list.map((event) => [String(event.data.query ?? ""), 0])).keys()
    ).slice(0, 40);
  }, [snapshot]);

  if (!snapshot) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo size="lg" />
        <p className="text-sm text-muted">
          {error ?? (refreshing ? "Loading telemetry…" : "No data yet.")}
        </p>
        <button
          type="button"
          onClick={() => {
            void load();
          }}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
        >
          Retry
        </button>
      </main>
    );
  }

  const totals = snapshot.totals;
  const topTitle = titleRows[0];
  const today = snapshot.series[snapshot.series.length - 1];
  const lastSeen = Math.max(
    0,
    ...snapshot.sessions.map((session) => session.lastSeen),
  );

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Logo size="lg" />
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-wider text-muted">
            Owner telemetry
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span>
            {snapshot.kv.configured ? "KV connected" : "KV missing"} · {snapshot.system.region || "local"}
          </span>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            className="rounded-lg border border-white/10 px-3 py-2 text-white transition-colors hover:bg-white/10"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-white/10 px-3 py-2 text-white transition-colors hover:bg-white/10"
          >
            Lock
          </button>
        </div>
      </header>

      <nav className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex gap-1 overflow-x-auto border-b border-white/10">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === entry.id
                ? "border-red-600 text-white"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      {tab === "overview" ? (
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Watched (30d)" value={formatHours(totals.seconds_watched ?? 0)} hint={`${totals.watch_stops ?? 0} sessions`} />
            <StatCard label="Today" value={formatHours(today?.seconds ?? 0)} hint={`${today?.watch_stops ?? 0} sessions`} />
            <StatCard label="Top title" value={topTitle?.title?.slice(0, 22) ?? "—"} hint={topTitle ? formatHours(topTitle.seconds) : undefined} />
            <StatCard label="Active devices" value={String(snapshot.sessions.length)} hint={`last seen ${relative(lastSeen)}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-card/40 p-5 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-white">Daily watch time</h2>
              <Sparkline series={snapshot.series} />
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card/40 p-5">
              <h2 className="text-sm font-semibold text-white">Storage</h2>
              {snapshot.kv.profiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{profile.name}</span>
                  <span className="text-xs text-muted">
                    {formatBytes(profile.bytes)} · {profile.historyCount} history · {profile.listCount} list
                  </span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>Environment</span>
                <span className="text-right">{snapshot.system.runtime}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Commit</span>
                <span className="truncate pl-3 text-right">
                  {snapshot.system.commit ? snapshot.system.commit.slice(0, 8) : "local"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Searches" value={String(totals.searches ?? 0)} hint={`${totals.row_clicks ?? 0} row clicks`} />
            <StatCard label="Surprise picks" value={String(totals.surprise_picks ?? 0)} hint={`${totals.season_switches ?? 0} season switches`} />
            <StatCard label="List changes" value={String((totals.list_adds ?? 0) + (totals.list_removes ?? 0))} hint={`${totals.list_adds ?? 0} added`} />
            <StatCard label="Errors" value={String((totals.player_errors ?? 0) + (totals.api_errors ?? 0))} hint={`${totals.player_errors ?? 0} player`} />
          </div>
        </section>
      ) : null}

      {tab === "viewing" ? (
        <section className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">
              When you watch (today, UTC hours)
            </h2>
            <HourHeatmap hours={snapshot.hours} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Most watched</h2>
            <Table
              headers={["Title", "Type", "Plays", "Watched", "Avg %", "Completed", "Last"]}
              rows={titleRows.map((entry) => [
                entry.title,
                entry.type,
                String(entry.plays),
                formatHours(entry.seconds),
                `${entry.avgPct}%`,
                String(entry.completed),
                relative(entry.lastAt),
              ])}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Daily breakdown</h2>
            <Table
              headers={["Date", "Watched", "Sessions", "Completed", "Player errors"]}
              rows={[...snapshot.series]
                .reverse()
                .filter((day) => day.seconds > 0 || day.watch_starts > 0)
                .map((day) => [
                  day.date,
                  formatHours(day.seconds),
                  String(day.watch_stops),
                  String(day.watch_completes),
                  String(day.player_errors),
                ])}
            />
          </div>

          {snapshot.genres.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
              <h2 className="mb-4 text-sm font-semibold text-white">Genres</h2>
              <Table
                headers={["Genre", "Watched"]}
                rows={snapshot.genres.map((genre) => [
                  genre.name,
                  formatHours(genre.seconds),
                ])}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "intent" ? (
        <section className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Recent searches</h2>
            {searches.length === 0 ? (
              <p className="text-sm text-muted">No searches recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {searches.map((query) => (
                  <span
                    key={query}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground"
                  >
                    {query}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Discovery signals</h2>
            <Table
              headers={["When", "Signal", "Detail"]}
              rows={(snapshot.events ?? [])
                .filter((event) =>
                  ["row_click", "surprise_pick", "list_toggle", "navigation"].includes(event.name)
                )
                .slice(0, 60)
                .map((event) => [
                  formatWhen(event.at),
                  event.name,
                  Object.entries(event.data)
                    .filter(([key]) => key !== "path")
                    .map(([key, value]) => `${key}=${value}`)
                    .join(" ") || "—",
                ])}
            />
          </div>
        </section>
      ) : null}

      {tab === "security" ? (
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Security events" value={String(snapshot.security.length)} hint="180d ring" />
            <StatCard
              label="Failed logins"
              value={String(snapshot.security.filter((event) => event.kind === "login_failure").length)}
              hint="profile PIN"
            />
            <StatCard label="API 401s" value={String(snapshot.security.filter((event) => event.kind === "unauthorized_api").length)} hint="unauthenticated" />
            <StatCard label="Known devices" value={String(snapshot.sessions.length)} hint="UA fingerprints" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Access log</h2>
            <Table
              headers={["When", "Event", "Who", "IP", "Device", "Country", "Note"]}
              rows={snapshot.security.map((event) => [
                formatWhen(event.at),
                event.kind.replace(/_/g, " "),
                event.profile ?? "admin",
                event.ip,
                event.device,
                event.country || "—",
                event.note || "—",
              ])}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Devices</h2>
            <Table
              headers={["Device", "IP", "Country", "Visits", "First seen", "Last seen"]}
              rows={snapshot.sessions.map((session) => [
                session.device,
                session.ip,
                session.country || "—",
                String(session.visits),
                relative(session.firstSeen),
                relative(session.lastSeen),
              ])}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-1 text-sm font-semibold text-white">Danger zone</h2>
            <p className="mb-4 text-xs text-muted">
              Removes every event, rollup, genre counter and device record. Watch history and
              watchlists are untouched.
            </p>
            <button
              type="button"
              onClick={() => {
                void purge();
              }}
              className="rounded-lg bg-red-600/90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
            >
              Purge telemetry
            </button>
          </div>
        </section>
      ) : null}

      {tab === "data" ? (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Raw event stream</h2>
            <a
              href="/api/admin/stats"
              download="manaltv-telemetry.json"
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/10"
            >
              Export JSON
            </a>
          </div>

          <div className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent -mx-1 max-h-[70vh] overflow-auto rounded-2xl border border-white/10 bg-card/40 p-2">
            <table className="w-full min-w-[760px] border-collapse text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Profile</th>
                  <th className="px-3 py-2 font-medium">Device</th>
                  <th className="px-3 py-2 font-medium">Geo</th>
                  <th className="px-3 py-2 font-medium">Payload</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.events.map((event, index) => (
                  <EventRow key={`${event.at}-${index}`} event={event} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    {tab === "system" ? (
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="KV"
              value={snapshot.kv.configured ? "Connected" : "Missing"}
              hint="Redis Cloud"
            />
            <StatCard label="Region" value={snapshot.system.region || "local"} hint="Vercel edge" />
            <StatCard
              label="Runtime"
              value={snapshot.system.runtime || "unknown"}
              hint={`generated ${formatWhen(snapshot.generatedAt)}`}
            />
            <StatCard
              label="Commit"
              value={snapshot.system.commit ? snapshot.system.commit.slice(0, 8) : "local"}
              hint={snapshot.system.deploymentId ? `build ${snapshot.system.deploymentId.slice(0, 8)}` : "no build id"}
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-1 text-sm font-semibold text-white">Environment</h2>
            <p className="mb-4 text-xs text-muted">
              Presence only. Values are never stored or sent to the browser.
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(snapshot.system.envPresent).map(([name, present]) => (
                <span
                  key={name}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    present
                      ? "border-red-600/40 bg-red-600/10 text-red-200"
                      : "border-white/10 bg-white/5 text-muted"
                  }`}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-card/40 p-5">
            <h2 className="mb-4 text-sm font-semibold text-white">Per-profile storage</h2>
            <Table
              headers={["Profile", "Key bytes", "History", "My List", "Events"]}
              rows={snapshot.kv.profiles.map((profile) => [
                profile.name,
                formatBytes(profile.bytes),
                String(profile.historyCount),
                String(profile.listCount),
                String(profile.events),
              ])}
            />
          </div>
        </section>
      ) : null}
    </main>
  );
}