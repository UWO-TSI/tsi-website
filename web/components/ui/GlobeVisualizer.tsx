"use client";

import dynamic from "next/dynamic";

const GlobeVisualizerWebGPU = dynamic(
    () => import("./GlobeVisualizerWebGPU"),
    { ssr: false }
);

export default function GlobeVisualizer({ className = "" }: { className?: string }) {
    return <GlobeVisualizerWebGPU className={className} />;
}
