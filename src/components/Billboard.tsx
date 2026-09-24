import Link from "next/link";
import { getBillboard } from "@/lib/tmdb-server";

const YOUTUBE_NOCOOKIE_URL = "https://www.youtube-nocookie.com/embed/";

export default async function Billboard() {
  const billboard = await getBillboard().catch(() => null);

  if (!billboard) return null;

  const { item, trailerKey } = billboard;

  const trailerSrc = trailerKey
    ? `${YOUTUBE_NOCOOKIE_URL}${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&loop=1&playlist=${trailerKey}`
    : null;

  return (
    <section
      aria-label="Featured title"
      className="relative -mt-24 h-[60vh] w-full overflow-hidden md:h-[85vh]"
    >
      {trailerSrc ? (
        <iframe
          src={trailerSrc}
          title={`${item.title} trailer`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover"
        />
      ) : item.backdropPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.backdropPath}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent md:bg-gradient-to-r md:from-[#050505] md:via-[#050505]/80"
      />

      <div className="absolute bottom-10 left-4 z-10 flex max-w-2xl flex-col gap-4 md:bottom-24 md:left-12">
        <h1 className="text-4xl font-black text-white drop-shadow-xl md:text-6xl">
          {item.title}
        </h1>

        {item.overview ? (
          <p className="line-clamp-3 text-sm text-gray-300 md:line-clamp-4 md:text-lg">
            {item.overview}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/watch/${item.type}/${item.id}`}
            className="flex items-center gap-2 rounded-md bg-white px-6 py-2 font-bold text-black transition hover:bg-gray-200 md:px-8 md:py-3"
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-5 w-5"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </Link>
          <Link
            href={`/title/${item.type}/${item.id}`}
            className="flex items-center gap-2 rounded-md bg-gray-500/50 px-6 py-2 font-bold text-white backdrop-blur-md transition hover:bg-gray-500/70 md:px-8 md:py-3"
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            More Info
          </Link>
        </div>
      </div>
    </section>
  );
}