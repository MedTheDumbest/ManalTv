export default function TitleLoading() {
  return (
    <main className="flex flex-1 flex-col">
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
    </main>
  );
}