import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import FadeInImage from "@/components/FadeInImage";
import BackButton from "@/components/BackButton";
import MediaMetaBadges from "@/components/MediaMetaBadges";
import MediaRow from "@/components/MediaRow";
import { RowSkeleton } from "@/components/RowSkeleton";
import TitlePlayButton from "@/components/TitlePlayButton";
import TrailerBlock from "@/components/TrailerBlock";
import WatchlistPill from "@/components/WatchlistPill";
import { getMediaDetails, getMediaDetailsWithVideos, getSimilar } from "@/lib/tmdb-server";

interface TitlePageProps {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({
  params,
}: TitlePageProps): Promise<Metadata> {
  const { type, id } = await params;

  if (type !== "movie" && type !== "tv") notFound();

  const mediaType = type as "movie" | "tv";
  const tmdbId = Number(id);

  try {
    const details = await getMediaDetails(String(tmdbId), mediaType);

    return {
      title: details.title,
      description: details.overview || undefined,
      alternates: { canonical: `/title/${mediaType}/${tmdbId}` },
      openGraph: {
        title: details.title,
        description: details.overview || undefined,
        type: "video.movie",
        images: details.backdropPath ? [{ url: details.backdropPath }] : [],
      },
    };
  } catch {
    return { title: "Title" };
  }
}

export default async function TitlePage({ params }: TitlePageProps) {
  const { type, id } = await params;

  if (type !== "movie" && type !== "tv") notFound();

  const mediaType = type as "movie" | "tv";
  const tmdbId = Number(id);

  return (
    <main className="relative flex flex-1 flex-col">
      <BackButton />

      <Suspense fallback={<TitleHeroSkeleton />}>
        <TitleHero tmdbId={tmdbId} mediaType={mediaType} />
      </Suspense>

      <section className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-10">
        <Suspense fallback={<RowSkeleton count={3} />}>
          <SimilarRow tmdbId={tmdbId} mediaType={mediaType} />
        </Suspense>
      </section>
    </main>
  );
}

async function TitleHero({
  tmdbId,
  mediaType,
}: {
  tmdbId: number;
  mediaType: "movie" | "tv";
}) {
  const mediaResult = await getMediaDetailsWithVideos(
    String(tmdbId),
    mediaType
  ).catch(() => null);

  if (!mediaResult) notFound();

  const details = mediaResult.item;
  const trailerKey = mediaResult.trailerKey;

  return (
    <section className="relative flex h-[85vh] w-full flex-col justify-end overflow-hidden">
      {details.backdropPath ? (
        <FadeInImage
          src={details.backdropPath}
          alt={details.title}
          fill
          priority
          quality={90}
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-card" />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"
      />

      <div className="absolute inset-0 z-10 flex items-center">
        <div className="flex max-w-xl flex-col gap-4 px-6 pb-24 sm:px-10">
          <MediaMetaBadges item={details} />

          <h1 className="max-w-xl text-[clamp(2.5rem,6vw,5rem)] font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-2xl">
            {details.title}
          </h1>

          {details.overview ? (
            <p className="line-clamp-4 text-sm leading-relaxed text-foreground sm:text-base">
              {details.overview}
            </p>
          ) : null}

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <TitlePlayButton tmdbId={tmdbId} type={mediaType} />
            {trailerKey ? <TrailerBlock trailerKey={trailerKey} /> : null}
            <WatchlistPill item={details} />
          </div>
        </div>
      </div>
    </section>
  );
}

async function SimilarRow({
  tmdbId,
  mediaType,
}: {
  tmdbId: number;
  mediaType: "movie" | "tv";
}) {
  const similar = await getSimilar(mediaType, tmdbId).catch(() => []);

  return similar.length > 0 ? (
    <MediaRow title="More Like This" items={similar} />
  ) : null;
}

function TitleHeroSkeleton() {
  return (
    <section className="flex h-[85vh] w-full flex-col justify-end overflow-hidden bg-card">
      <div className="relative z-10 flex flex-col gap-4 px-6 pb-16 sm:px-10 sm:pb-20">
        <div className="h-4 w-40 motion-safe:animate-pulse rounded bg-card" />
        <div className="h-16 w-72 motion-safe:animate-pulse rounded bg-card md:w-[28rem]" />
        <div className="mt-2 flex gap-3">
          <div className="h-12 w-32 motion-safe:animate-pulse rounded-full bg-card" />
          <div className="h-12 w-36 motion-safe:animate-pulse rounded-full bg-card" />
        </div>
      </div>
    </section>
  );
}