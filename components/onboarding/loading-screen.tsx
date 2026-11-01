import { QuiverMark } from "@/components/quiver-mark";

/** Fades in after a moment, so a quick start never flashes it. */
export function LoadingScreen() {
  return (
    <main
      role="status"
      className="flex min-h-svh animate-in flex-col items-center justify-center gap-3 delay-300 duration-300 fade-in fill-mode-backwards"
    >
      <QuiverMark className="size-10 text-primary" />
      <p className="text-sm text-muted-foreground">Opening your prompts…</p>
    </main>
  );
}
