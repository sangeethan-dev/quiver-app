"use client";

import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Stage 1 placeholder: shows the theme tokens. Replaced by the vault UI in Stage 4.
const surfaces = [
  { name: "Level 0", className: "bg-surface-0" },
  { name: "Level 1", className: "bg-surface-1" },
  { name: "Level 2", className: "bg-surface-2" },
  { name: "Level 3", className: "bg-surface-3" },
];

export default function Home() {
  const { setTheme } = useTheme();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Quiver</h1>
        <p className="text-sm text-muted-foreground">Scaffold check: surfaces, type and theme.</p>
      </header>

      <section className="grid grid-cols-4 gap-3">
        {surfaces.map((surface) => (
          <div key={surface.name} className={`${surface.className} rounded-lg px-3 py-6 text-sm`}>
            {surface.name}
          </div>
        ))}
      </section>

      <pre className="rounded-lg bg-surface-1 p-4 font-mono text-sm whitespace-pre-wrap">
        {"Rewrite the text below in a {{tone|friendly}} tone for {{audience}}."}
      </pre>

      <section className="flex flex-wrap gap-2">
        <Button onClick={() => toast("Prompt copied")}>Show toast</Button>
        <Button variant="secondary" onClick={() => setTheme("system")}>
          System
        </Button>
        <Button variant="secondary" onClick={() => setTheme("dark")}>
          Dark
        </Button>
        <Button variant="secondary" onClick={() => setTheme("light")}>
          Light
        </Button>
      </section>
    </main>
  );
}
