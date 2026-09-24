interface LogoProps {
  size?: "md" | "lg";
}

export default function Logo({ size = "md" }: LogoProps) {
  const wordmarkSize =
    size === "lg" ? "text-2xl" : "text-xl";

  return (
    <span
      aria-label="ManalTv"
      className="inline-flex items-baseline"
    >
      <span className={`${wordmarkSize} font-semibold leading-none tracking-tight text-white`}>
        manal
      </span>
      <span className={`${wordmarkSize} font-semibold leading-none tracking-tight text-red-600`}>
        .tv
      </span>
    </span>
  );
}