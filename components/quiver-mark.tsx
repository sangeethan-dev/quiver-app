import type { SVGProps } from "react";

/** An arrow on the diagonal. The fletching sweeps back from the shaft, away from the head. */
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
      <path d="M4 20 20 4" />
      <path d="M13.5 4H20v6.5" />
      <path d="M9.5 14.5H5m4.5 0V19" />
    </svg>
  );
}
