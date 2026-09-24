import { Suspense } from "react";
import Billboard from "@/components/Billboard";
import ContinueWatching from "@/components/ContinueWatching";
import MyList from "@/components/MyList";
import RecentlyAdded from "@/components/RecentlyAdded";
import Unwatched from "@/components/Unwatched";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-8 pb-12 pt-24">
      <Suspense fallback={<BillboardSkeleton />}>
        <Billboard />
      </Suspense>
      <div className="flex flex-col gap-8">
        <ContinueWatching />
        <RecentlyAdded />
        <MyList />
        <Unwatched />
      </div>
    </main>
  );
}

function BillboardSkeleton() {
  return (
    <section className="relative -mt-24 h-[60vh] w-full animate-pulse overflow-hidden bg-card md:h-[85vh]" />
  );
}