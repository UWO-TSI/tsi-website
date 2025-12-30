"use client";

import { CompanyHero } from "@/components/hero/CompanyHero";
import BuildSection from "./build/BuildSection";
import WorkSection from "./work/WorkSection";
import TalentSection from "./talent/TalentSection";
import TeamSection from "./team/TeamSection";
import FAQSection from "./faqs/FAQSection";
import GetStartedSection from "./get started/GetStartedSection";

export default function CompanyPage() {
  return (
    <>
      <section id="hero">
        <CompanyHero
          title={
            <>
              Technology & Talent
              <br />
              For Ambitious Companies.
            </>
          }
          ctas={[
            {
              label: "Start a Project",
              helperText: "Custom software, AI, and design services",
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
      
      <section id="work">
        <WorkSection />
      </section>

      <section id="talent">
        <TalentSection />
      </section>

      <section id="team">
        <TeamSection />
      </section>

      <section id="faqs">
        <FAQSection />
      </section>

      <section id="get-started">
        <GetStartedSection />
      </section>
    </>
  );
}