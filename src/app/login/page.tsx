"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resetRemoteStores } from "@/lib/remote-stores";
import type { ProfileId } from "@/lib/accounts";

interface ProfileOption {
  id: ProfileId;
  name: string;
  initials: string;
  gradient: string;
  accent: string;
}

const PROFILE_OPTIONS: ProfileOption[] = [
  {
    id: "manal",
    name: "Manal",
    initials: "M",
    gradient: "bg-linear-to-br from-rose-500 via-pink-600 to-fuchsia-800",
    accent: "text-rose-300",
  },
  {
    id: "amine",
    name: "Mohammed Amine",
    initials: "MA",
    gradient: "bg-linear-to-br from-cyan-500 via-sky-600 to-indigo-800",
    accent: "text-sky-300",
  },
];

const PIN_LENGTH = 4;

const KEYS_BASE =
  "flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold text-foreground transition-all duration-150 select-none active:scale-90 active:bg-white/15 sm:h-20 sm:w-20";

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<ProfileOption | null>(null);
  const [pin, setPin] = useState("");
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);

  const resetPin = useCallback(() => setPin(""), []);

  const goBack = useCallback(() => {
    setSelected(null);
    resetPin();
    setShaking(false);
  }, [resetPin]);

  const handleWrongPin = useCallback(() => {
    setPin("");
    setShaking(true);
    window.setTimeout(() => setShaking(false), 500);
  }, []);

  const submit = useCallback(
    async (profile: ProfileId, pinValue: string) => {
      if (busy) return;

      setBusy(true);

      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, pin: pinValue }),
        });

        if (!res.ok) {
          handleWrongPin();
          return;
        }

        resetRemoteStores();
        router.push("/");
        router.refresh();
      } catch {
        handleWrongPin();
      } finally {
        setBusy(false);
      }
    },
    [busy, handleWrongPin, router]
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (!selected || busy) return;
      if (pin.length >= PIN_LENGTH) return;

      const next = pin + digit;
      setPin(next);

      if (next.length === PIN_LENGTH) {
        void submit(selected.id, next);
      }
    },
    [busy, pin, selected, submit]
  );

  const handleBackspace = useCallback(() => {
    if (busy) return;
    setPin((current) => current.slice(0, -1));
  }, [busy]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selected) return;

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        handleDigit(event.key);
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        handleBackspace();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        goBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goBack, handleBackspace, handleDigit, selected]);

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      {selected ? (
        <section
          className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-10 animate-[fade-up_0.3s_ease-out]"
          aria-label={`Enter PIN for ${selected.name}`}
        >
          <button
            type="button"
            onClick={goBack}
            aria-label="Back to profiles"
            className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-foreground backdrop-blur-xl transition hover:bg-white/10 sm:left-6 sm:top-6"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={`flex flex-col items-center gap-3 ${shaking ? "animate-[shake_0.45s_ease-in-out]" : ""}`}>
            <div
              aria-hidden="true"
              className={`flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${selected.gradient} text-4xl font-bold text-white shadow-xl`}
            >
              {selected.initials}
            </div>
            <p className={`text-lg font-medium ${selected.accent}`}>
              {selected.name}
            </p>
          </div>

          <div
            className="flex gap-4"
            role="group"
            aria-label="Enter your 4-digit PIN"
          >
            {Array.from({ length: PIN_LENGTH }, (_, index) => {
              const filled = index < pin.length;
              return (
                <span
                  key={index}
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                    filled
                      ? "scale-110 bg-white"
                      : "bg-white/20 ring-1 ring-white/10"
                  }`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6">
            {Array.from({ length: 9 }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleDigit(String(index + 1))}
                className={`${KEYS_BASE} bg-white/5 ring-1 ring-white/10 hover:bg-white/10`}
              >
                {index + 1}
              </button>
            ))}
            <span aria-hidden="true" />
            <button
              type="button"
              onClick={() => handleDigit("0")}
              className={`${KEYS_BASE} bg-white/5 ring-1 ring-white/10 hover:bg-white/10`}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Delete digit"
              disabled={pin.length === 0}
              className={`${KEYS_BASE} bg-transparent text-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-6 w-6"
              >
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <path d="m18 9-6 6M12 9l6 6" />
              </svg>
            </button>
          </div>
        </section>
      ) : (
        <section
          className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-10 animate-[fade-up_0.3s_ease-out]"
          aria-label="Choose a profile"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Who&apos;s watching?
          </h1>

          <div className="flex flex-col gap-6 sm:flex-row sm:gap-10">
            {PROFILE_OPTIONS.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => setSelected(profile)}
                className="group flex flex-col items-center gap-3 rounded-2xl p-4 outline-none transition-all duration-300 hover:bg-hover focus-visible:bg-hover hover:scale-105 focus-visible:scale-105"
              >
                <span
                  aria-hidden="true"
                  className={`flex h-28 w-28 items-center justify-center rounded-xl bg-gradient-to-br ${profile.gradient} text-4xl font-bold text-white shadow-xl transition-shadow duration-300 group-hover:shadow-2xl sm:h-32 sm:w-32`}
                >
                  {profile.initials}
                </span>
                <span className="text-sm font-medium text-muted transition-colors duration-300 group-hover:text-primary">
                  {profile.name}
                </span>
              </button>
            ))}
          </div>

          <p className="max-w-sm text-center text-xs text-muted">
            Each profile keeps its own watch history and My List, synced across
            every device.
          </p>
        </section>
      )}
    </main>
  );
}