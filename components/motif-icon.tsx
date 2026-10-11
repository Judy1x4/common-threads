import { MOTIF_BOX, MOTIFS } from "@/lib/catalogue";
import type { MotifId } from "@/lib/types";

export function MotifIcon({ id, color = "currentColor", className }: { id: MotifId; color?: string; className?: string }) {
  return (
    <svg viewBox={`0 0 ${MOTIF_BOX} ${MOTIF_BOX}`} className={className} aria-hidden="true">
      <path d={MOTIFS[id].path} fill={color} fillRule="evenodd" stroke={color} strokeWidth={4} strokeLinejoin="round" />
    </svg>
  );
}
