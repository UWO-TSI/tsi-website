"use client";

import dynamic from "next/dynamic";
import type { DiveRef } from "./GlobeVisualizerWebGPU";

const GlobeVisualizerWebGPU = dynamic(
    () => import("./GlobeVisualizerWebGPU"),
    { ssr: false }
);

export default function GlobeVisualizer({ className = "", dive, base }: { className?: string; dive?: DiveRef; base?: number }) {
    return <GlobeVisualizerWebGPU className={className} dive={dive} base={base} />;
}
