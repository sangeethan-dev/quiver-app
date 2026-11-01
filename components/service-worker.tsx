"use client";

import { useEffect } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Offline support is an extra, so a browser that refuses it just stays online-only. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { scope: `${basePath}/`, updateViaCache: "none" })
      .catch(() => undefined);
  }, []);

  return null;
}
