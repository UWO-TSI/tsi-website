"use client";

import dynamic from "next/dynamic";
import type { DiveRef } from "./GlobeVisualizerWebGPU";

const GlobeVisualizerWebGPU = dynamic(
    () => import("./GlobeVisualizerWebGPU"),
    { ssr: false }
);

export default function GlobeVisualizer({ className = "", dive, base }: { className?: string; dive?: DiveRef; base?: number }) {
    // The loading screen waits for the globe's first frame (its shaders compile then), marked on this wrapper.
    return <div data-ready-wait="globe" style={{ display: "contents" }}><GlobeVisualizerWebGPU className={className} dive={dive} base={base} /></div>;
}
