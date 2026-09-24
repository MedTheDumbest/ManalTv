"use client";

interface BoundaryErrorProps {
  reset: () => void;
  title?: string;
  message?: string;
}

export default function BoundaryError({
  reset,
  title = "Something went wrong",
  message = "The content could not be loaded. Your connection or the content source may be having issues.",
}: BoundaryErrorProps) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">
        Error
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
        {title}
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">{message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-transform duration-300 hover:scale-105 hover:bg-zinc-200"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0 1 13.66-4.66L20 7M4 14l2.34.66A8 8 0 0 0 20 10"
          />
        </svg>
        Try Again
      </button>
    </main>
  );
}