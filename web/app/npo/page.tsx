"use client";

import SmoothScroll from "@/components/SmoothScroll";
import NPOHomePage from "./npo_homePage";
import NPOaboutProgram from "./npo_aboutProgram";
import NPOFormSubmission from "./npo_formSubmission";
import Impact from "./Impact";

export default function NonprofitPage() {
  return (
    <SmoothScroll>
      <main className="min-h-screen">
        <NPOHomePage />
        <NPOaboutProgram />
        <NPOFormSubmission />
        <Impact />
      </main>
    </SmoothScroll>
  );
}


