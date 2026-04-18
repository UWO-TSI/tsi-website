"use client";

import dynamic from "next/dynamic";

const GlobeTest = dynamic(() => import("./GlobeTest"), { ssr: false });

export default function GlobeTestPage() {
    return <GlobeTest />;
}
