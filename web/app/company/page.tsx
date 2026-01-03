"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function CompanyPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero animation
      gsap.fromTo(
        heroRef.current,
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 1.2, ease: "power3.out" }
      );

      // Grid items animation
      if (gridRef.current) {
        const items = gridRef.current.children;
        gsap.fromTo(
          items,
          { opacity: 0, y: 50, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.6,
            stagger: 0.1,
            ease: "back.out(1.2)",
            scrollTrigger: {
              trigger: gridRef.current,
              start: "top 75%",
            },
          }
        );
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <SmoothScroll>
      <main className="min-h-screen bg-[#0F0F10]">
        {/* Hero Section - Grid Layout */}
        <section 
          ref={heroRef}
          className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20"
        >
          <div className="max-w-7xl mx-auto w-full">
            <div className="text-center mb-16">
              <h1 className="font-heading text-6xl md:text-7xl font-semibold mb-6">
                For Companies
              </h1>
              <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
                Hire for scoped projects and consulting. Access top student talent 
                for your development needs.
              </p>
            </div>

            {/* Service Grid */}
            <div ref={gridRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="glass-card p-8 rounded-2xl hover:scale-105 transition-transform">
                <h3 className="font-heading text-2xl font-semibold mb-3">Web Development</h3>
                <p className="text-zinc-400">
                  Custom web applications built with modern frameworks and best practices.
                </p>
              </div>
              <div className="glass-card p-8 rounded-2xl hover:scale-105 transition-transform">
                <h3 className="font-heading text-2xl font-semibold mb-3">Mobile Apps</h3>
                <p className="text-zinc-400">
                  iOS and Android applications designed for performance and user experience.
                </p>
              </div>
              <div className="glass-card p-8 rounded-2xl hover:scale-105 transition-transform">
                <h3 className="font-heading text-2xl font-semibold mb-3">Consulting</h3>
                <p className="text-zinc-400">
                  Technical consulting and architecture guidance from experienced developers.
                </p>
              </div>
              <div className="glass-card p-8 rounded-2xl hover:scale-105 transition-transform">
                <h3 className="font-heading text-2xl font-semibold mb-3">API Development</h3>
                <p className="text-zinc-400">
                  Robust backend services and APIs to power your applications.
                </p>
              </div>
              <div className="glass-card p-8 rounded-2xl hover:scale-105 transition-transform">
                <h3 className="font-heading text-2xl font-semibold mb-3">DevOps</h3>
                <p className="text-zinc-400">
                  Infrastructure setup, CI/CD pipelines, and deployment automation.
                </p>
              </div>
              <div className="glass-card p-8 rounded-2xl hover:scale-105 transition-transform">
                <h3 className="font-heading text-2xl font-semibold mb-3">UI/UX Design</h3>
                <p className="text-zinc-400">
                  Beautiful, intuitive interfaces that users love to interact with.
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <button className="rounded-full bg-[#002FA7] px-8 py-4 text-base font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
                Get Started
              </button>
            </div>
          </div>
        </section>

        {/* Additional Content */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="glass-card p-12 rounded-3xl">
            <h2 className="font-heading text-4xl font-semibold mb-6">Why Work With Us</h2>
            <div className="grid md:grid-cols-2 gap-8 mt-8">
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-3">Cost-Effective</h3>
                <p className="text-zinc-400">
                  Access top-tier development talent at competitive rates, perfect for 
                  startups and growing companies.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-3">Flexible Engagement</h3>
                <p className="text-zinc-400">
                  From short-term projects to long-term partnerships, we adapt to your needs.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-3">Modern Stack</h3>
                <p className="text-zinc-400">
                  We use the latest technologies and frameworks to build scalable, 
                  maintainable solutions.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-3">Dedicated Teams</h3>
                <p className="text-zinc-400">
                  Work with committed student developers who are passionate about 
                  delivering quality results.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SmoothScroll>
  );
}

