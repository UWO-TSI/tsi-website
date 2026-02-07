"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { CompanyHero } from "@/components/hero/CompanyHero";
import BuildSection from "./build/BuildSection";
import ProgramsSection from "./programs/ProgramsSection";
import AlumniSection from "./alumni/AlumniSection";
import WorkSection from "./work/WorkSection";
import FAQSection from "./faqs/FAQSection";
import GetStartedSection from "./get started/GetStartedSection";

export default function CompanyPage() {
  return (
    <SmoothScroll>
      <section id="hero">
        <CompanyHero
          title={
            <>
              Build With Us.
              <br />
              Hire From Us.
            </>
          }
          ctas={[
            {
              label: "Start a Project",
              helperText:
                "Custom software, AI, and design services",
            },
            {
              label: "Partner for Talent",
              helperText:
                "Access top student developers through our guided summer program",
              variant: "secondary",
            },
          ]}
        />
      </section>

      <section id="build">
        <BuildSection />
      </section>

      <section id="programs">
        <ProgramsSection />
      </section>

      <section id="alumni">
        <AlumniSection />
      </section>

      <section id="work">
        <WorkSection />
      </section>

      <section id="faqs">
        <FAQSection />
      </section>

      <section id="get-started">
        <GetStartedSection />
      </section>
    </SmoothScroll>
  );
}
