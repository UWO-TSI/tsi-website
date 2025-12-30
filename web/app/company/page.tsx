"use client";

import { CompanyHero } from "@/components/hero/CompanyHero";

export default function CompanyPage() {
  return (
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
  );
}