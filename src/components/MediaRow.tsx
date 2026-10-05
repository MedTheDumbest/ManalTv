import MediaRowSection from "@/components/MediaRowSection";
import SmartMediaCard from "@/components/SmartMediaCard";
import type { MediaItem } from "@/types";
import type { ReactNode } from "react";

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  showNewBadge?: boolean;
  headerAction?: ReactNode;
}

export default function MediaRow({
  title,
  items,
  showNewBadge = false,
  headerAction,
}: MediaRowProps) {
  return (
    <MediaRowSection title={title} headerAction={headerAction}>
      {items.map((item) => (
        <SmartMediaCard
          key={`${item.type}-${item.id}`}
          item={item}
          showNewBadge={showNewBadge}
          rowLabel={title}
        />
      ))}
    </MediaRowSection>
  );
}