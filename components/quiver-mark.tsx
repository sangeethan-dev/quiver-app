import type { SVGProps } from "react";

/** A slim quiver holding three arrows, seen by their notched feathers. One flat color. */
export function QuiverMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true" {...props}>
      <g transform="rotate(14 32 32)">
        <path d="M18.25 4 22 8.65 25.75 4v19h-7.5z" />
        <path d="M28.25 3 32 7.65 35.75 3v20h-7.5z" />
        <path d="M38.25 4 42 8.65 45.75 4v19h-7.5z" />
        <path d="M17 26h30v3a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z" />
        <path d="M20 34.5h24l-3.2 23a3 3 0 0 1-3 2.5H26.2a3 3 0 0 1-3-2.500z" />
      </g>
    </svg>
  );
}
