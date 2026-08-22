"use client";

import dynamic from "next/dynamic";

const StudioClient = dynamic(() => import("./studio-client"), {
  ssr: false,
  loading: () => (
    <main className="app-loading" aria-live="polite">
      Markdown教材PDF Studioを読み込んでいます…
    </main>
  ),
});

export default function Page() {
  return <StudioClient />;
}
