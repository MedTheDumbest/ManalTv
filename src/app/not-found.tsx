import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">
        404
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
        Title not found
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        This title may have been removed, or the link is incorrect.
      </p>
      <Link
        href="/"
        className="mt-2 flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-transform duration-300 hover:scale-105 hover:bg-zinc-200"
      >
        Back to Home
      </Link>
    </main>
  );
}