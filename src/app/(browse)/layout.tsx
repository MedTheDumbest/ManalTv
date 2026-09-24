import type { ReactNode } from "react";
import Logo from "@/components/Logo";
import Navbar from "@/components/Navbar";

export default function BrowseLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <footer className="border-t border-white/8 px-6 py-8 text-xs text-muted sm:px-10">
        <Logo />
        <p className="mt-1">
          A cinematic streaming experience. Content metadata via TMDB.
        </p>
      </footer>
    </>
  );
}