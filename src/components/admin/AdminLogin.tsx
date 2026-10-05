"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error" | "unconfigured">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/auth")
      .then((response) => response.json())
      .then((data: { configured?: boolean }) => {
        if (cancelled) return;
        if (data.configured === false) setStatus("unconfigured");
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!password || status === "checking") return;

      setStatus("checking");
      setMessage("");

      try {
        const response = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });

        const data = (await response.json()) as {
          ok?: boolean;
          error?: string;
          remaining?: number;
        };

        if (response.ok && data.ok) {
          setPassword("");
          router.replace("/admin");
          router.refresh();
          return;
        }

        setStatus("error");
        setMessage(
          data.remaining !== undefined && data.remaining < 8
            ? `${data.error ?? "Failed"} — ${data.remaining} attempts left`
            : (data.error ?? "Failed")
        );
      } catch {
        setStatus("error");
        setMessage("Network error");
      }
    },
    [password, router, status]
  );

  return (
    <form
      onSubmit={submit}
      className="flex w-full max-w-xs flex-col gap-4 rounded-2xl border border-white/10 bg-card/60 p-6 backdrop-blur-xl"
    >
      <div className="flex flex-col gap-1 text-center">
        <span className="text-xs font-medium uppercase tracking-widest text-muted">
          Restricted
        </span>
        <span className="text-sm text-muted">Owner access only</span>
      </div>

      <input
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
        placeholder="Admin password"
        autoComplete="current-password"
        aria-label="Admin password"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none transition-colors placeholder:tracking-normal placeholder:text-zinc-600 focus:border-white/30"
      />

      {message ? (
        <p className="text-center text-xs text-red-400">{message}</p>
      ) : null}

      {status === "unconfigured" ? (
        <p className="text-center text-xs text-amber-400">
          ADMIN_PASSWORD is not set on this deployment.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "checking" || !password}
        className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "checking" ? "Verifying…" : "Unlock dashboard"}
      </button>
    </form>
  );
}