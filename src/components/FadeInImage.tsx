"use client";

import Image from "next/image";
import { useState } from "react";
import type { ImageProps } from "next/image";

type FadeInImageProps = Omit<ImageProps, "onLoad">;

export default function FadeInImage({ alt, className = "", ...rest }: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Image
      {...rest}
      alt={alt}
      onLoad={() => setLoaded(true)}
      className={`transition-opacity duration-700 ease-out motion-reduce:transition-none ${
        loaded ? "opacity-100" : "opacity-0"
      } ${className}`}
    />
  );
}