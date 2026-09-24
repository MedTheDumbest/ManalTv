interface LogoProps {
  size?: "md" | "lg";
}

export default function Logo({ size = "md" }: LogoProps) {
  const wordmarkSize =
    size === "lg" ? "text-2xl" : "text-xl";
  const markSize = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  const glyphSize = size === "lg" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      aria-label="ManalTv"
      className="inline-flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className={`flex ${markSize} items-center justify-center rounded-[8px] bg-red-600 shadow-[0_0_16px_rgba(220,38,38,0.35)]`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className={`${glyphSize} ml-px text-white`}
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className={`${wordmarkSize} font-semibold tracking-tight text-white`}>
        Manal<span className="text-red-600">Tv</span>
      </span>
    </span>
  );
}