"use client";

import dynamic from "next/dynamic";

const AIHubPage = dynamic(() => import("./ai-content"), { ssr: false });

export default function Page() {
  return <AIHubPage />;
}
