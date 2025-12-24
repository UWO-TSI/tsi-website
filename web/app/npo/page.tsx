"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function NonprofitPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        heroRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
      );

      gsap.fromTo(
        contentRef.current?.children,
        { opacity: 0, y: 30 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.8, 
          stagger: 0.2, 
          ease: "power2.out",
          scrollTrigger: {
            trigger: contentRef.current,
            start: "top 80%",
          }
        }
      );
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-[#0F0F10]">
        {/* Hero Section */}
        <section 
          ref={heroRef}
          className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-heading text-6xl md:text-7xl font-semibold mb-6">
              For Nonprofits
            </h1>
            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
              Pro bono software support for 1 year. We build modern solutions 
              that help you serve your community better.
            </p>
            <div className="flex gap-4 justify-center">
              <button className="rounded-full bg-[#002FA7] px-6 py-3 text-sm font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
                Apply Now
              </button>
              <button className="rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
                Learn More
              </button>
            </div>
          </div>
        </section>

        {/* Content Sections */}
        <section ref={contentRef} className="max-w-6xl mx-auto px-6 pb-24 space-y-32">
          <div className="glass-card p-12 rounded-3xl">
            <h2 className="font-heading text-4xl font-semibold mb-6">What We Offer</h2>
            <p className="text-lg text-zinc-400 leading-relaxed">
              Our student developers work with your organization to build custom software 
              solutions tailored to your needs. From web applications to mobile apps, 
              we provide full-stack development services at no cost.
            </p>
          </div>

          <div className="glass-card p-12 rounded-3xl">
            <h2 className="font-heading text-4xl font-semibold mb-6">The Process</h2>
            <div className="grid md:grid-cols-3 gap-8 mt-8">
              <div>
                <div className="text-3xl font-bold text-[#002FA7] mb-3">01</div>
                <h3 className="font-heading text-xl font-semibold mb-2">Apply</h3>
                <p className="text-zinc-400">Submit your organization's information and project needs.</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#002FA7] mb-3">02</div>
                <h3 className="font-heading text-xl font-semibold mb-2">Match</h3>
                <p className="text-zinc-400">We pair you with a dedicated team of student developers.</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#002FA7] mb-3">03</div>
                <h3 className="font-heading text-xl font-semibold mb-2">Build</h3>
                <p className="text-zinc-400">Work together to create impactful software solutions.</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-12 rounded-3xl">
            <h2 className="font-heading text-4xl font-semibold mb-6">Success Stories</h2>
            <p className="text-lg text-zinc-400 leading-relaxed">
              See how we've helped nonprofits across the country leverage technology 
              to amplify their impact and serve their communities more effectively.
            </p>
          </div>
        </section>
      </main>
    </SmoothScroll>
  );
}

