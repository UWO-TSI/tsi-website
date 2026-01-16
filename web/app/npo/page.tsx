"use client";

import { useEffect, useRef } from "react";
import NPOHomePage from "./npo_homePage";
import NPOaboutProgram from "./about/npo_aboutProgram";
import CompaniesBuildTimeline from "./about/npo_aboutProgram_cont";
import NPOFormSubmission from "./about/npo_formSubmission";
import Impact from "./impact/Impact";
import Team from "./team/team";
import Testimonial from "./testimonial/testimonial";
import TestimonialsSection from "./testimonial/TestimonialsSection";
import CTA from "./CTA/cta";
import FAQ from "./FAQ/faq";



export default function NonprofitPage() {
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const pendingHash = useRef<string | null>(null);

  // On load, jump to the section indicated by the URL hash (e.g., /npo#faq)
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    pendingHash.current = hash || null;
    if (!hash) return;

    // Wait for refs to be set and layout to complete
    const scrollToSection = () => {
      const target = sectionRefs.current[hash];
      if (target) {
        // Use instant scroll on initial load for better UX
        window.scrollTo({
          top: target.offsetTop,
          behavior: "instant",
        });
      }
    };

    // Try immediately and also after a short delay to ensure refs are set
    scrollToSection();
    const timer = setTimeout(scrollToSection, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const updateURL = () => {
      const sections = Object.entries(sectionRefs.current);
      const scrollPosition = window.scrollY + window.innerHeight / 2;

      let currentSection = "home";

      for (const [id, element] of sections) {
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            currentSection = id;
            break;
          }
        }
      }

      // If navigating directly to a hash, avoid clearing it until that section is reached
      if (pendingHash.current) {
        console.log("⏳ Pending hash:", pendingHash.current, "Current section:", currentSection);
        if (currentSection === pendingHash.current) {
          const newPath = currentSection === "home" ? "/npo" : `/npo#${currentSection}`;
          console.log("✅ URL updated to:", newPath);
          window.history.replaceState(null, "", newPath);
          pendingHash.current = null;
        }
        return;
      }

      const newPath = currentSection === "home" ? "/npo" : `/npo#${currentSection}`;
      const currentPath = window.location.pathname + window.location.hash;
      
      if (currentPath !== newPath) {
        console.log("🔄 URL updated to:", newPath);
        window.history.replaceState(null, "", newPath);
      }
    };

    // Update URL on scroll with throttling
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateURL();
          ticking = false;
        });
        ticking = true;
      }
    };

    // Wait a bit before starting to listen to scroll to avoid premature URL changes
    const startDelay = setTimeout(() => {
      window.addEventListener("scroll", handleScroll);
      updateURL(); // Initial check
    }, 500);

    return () => {
      clearTimeout(startDelay);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <main className="min-h-screen">
      <div
        id="home"
        ref={(el) => {
          sectionRefs.current.home = el;
        }}
      >
        <NPOHomePage />
      </div>
      <div
        id="about"
        ref={(el) => {
          sectionRefs.current.about = el;
        }}
      >
        <NPOaboutProgram />
      </div>
      <div
        id="application"
        ref={(el) => {
          sectionRefs.current.application = el;
        }}
        style={{ position: "relative", zIndex: 10 }}
      >
        <CompaniesBuildTimeline />
      </div>
      <div
        id="form"
        ref={(el) => {
          sectionRefs.current.form = el;
        }}
        style={{ position: "relative", zIndex: 20 }}
        className="min-h-screen"
      >
        <NPOFormSubmission />
      </div>
      <div
        id="impact"
        ref={(el) => {
          sectionRefs.current.impact = el;
        }}
      >
        <Impact />
      </div>
      <div
        id="team"
        className="min-h-screen"
        ref={(el) => {
          sectionRefs.current.team = el;
        }}
        style={{ position: "relative", zIndex: 20 }}
      >
        <Team />
      </div>
      <div
        id="testimonial"
        className="min-h-screen"
        ref={(el) => {
          sectionRefs.current.testimonial = el;
        }}
      >
        <TestimonialsSection />
      </div>
      <div
        id="faq"
        className="min-h-screen"
        ref={(el) => {
          sectionRefs.current.faq = el;
        }}
      >
        <FAQ />
      </div>
      <div
        id="cta"
        className="min-h-screen"
        ref={(el) => {
          sectionRefs.current.cta = el;
        }}
      >
        <CTA />
      </div>
    </main>
  );
}


