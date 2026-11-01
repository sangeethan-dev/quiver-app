import type { SVGProps } from "react";

/** An arrow drawn on the diagonal, with two fletching strokes at the tail. */
export function QuiverMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 19 19 5" />
      <path d="M12.5 5H19v6.5" />
      <path d="M5 14v5h5" />
      <path d="M8.5 10.5v5h5" />
    </svg>
  );
}
