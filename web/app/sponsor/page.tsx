"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function SponsorPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero fade in
      gsap.fromTo(
        heroRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 1, ease: "power2.out" }
      );

      // Stats counter animation
      if (statsRef.current) {
        const stats = statsRef.current.querySelectorAll("[data-stat]");
        stats.forEach((stat) => {
          const target = parseInt(stat.getAttribute("data-target") || "0");
          const duration = 2;
          const obj = { value: 0 };
          
          ScrollTrigger.create({
            trigger: stat,
            start: "top 80%",
            onEnter: () => {
              gsap.to(obj, {
                value: target,
                duration: duration,
                ease: "power2.out",
                onUpdate: () => {
                  stat.textContent = Math.round(obj.value).toLocaleString();
                },
              });
            },
          });
        });
      }

      // Timeline animation
      if (timelineRef.current) {
        const items = timelineRef.current.children;
        gsap.fromTo(
          items,
          { opacity: 0, x: -50 },
          {
            opacity: 1,
            x: 0,
            duration: 0.8,
            stagger: 0.2,
            ease: "power2.out",
            scrollTrigger: {
              trigger: timelineRef.current,
              start: "top 70%",
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
        {/* Hero Section - Impact Focused */}
        <section 
          ref={heroRef}
          className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20"
        >
          <div className="max-w-5xl mx-auto text-center">
            <h1 className="font-heading text-6xl md:text-7xl font-semibold mb-6">
              For Sponsors
            </h1>
            <p className="text-2xl text-zinc-300 mb-4 max-w-3xl mx-auto">
              Fund tech that drives social impact
            </p>
            <p className="text-lg text-zinc-400 mb-12 max-w-2xl mx-auto">
              Support the next generation of developers while enabling nonprofits 
              to leverage technology for greater good.
            </p>
            <button className="rounded-full bg-[#002FA7] px-8 py-4 text-base font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
              Become a Sponsor
            </button>
          </div>
        </section>

        {/* Impact Stats */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <div ref={statsRef} className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div 
                data-stat
                data-target="50"
                className="font-heading text-5xl font-bold text-[#002FA7] mb-2"
              >
                0
              </div>
              <p className="text-zinc-400">Nonprofits Served</p>
            </div>
            <div className="text-center">
              <div 
                data-stat
                data-target="200"
                className="font-heading text-5xl font-bold text-[#002FA7] mb-2"
              >
                0
              </div>
              <p className="text-zinc-400">Student Developers</p>
            </div>
            <div className="text-center">
              <div 
                data-stat
                data-target="100"
                className="font-heading text-5xl font-bold text-[#002FA7] mb-2"
              >
                0
              </div>
              <p className="text-zinc-400">Projects Completed</p>
            </div>
            <div className="text-center">
              <div 
                data-stat
                data-target="10000"
                className="font-heading text-5xl font-bold text-[#002FA7] mb-2"
              >
                0
              </div>
              <p className="text-zinc-400">Lives Impacted</p>
            </div>
          </div>
        </section>

        {/* Sponsorship Tiers */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <h2 className="font-heading text-4xl font-semibold text-center mb-12">
            Sponsorship Tiers
          </h2>
          <div ref={timelineRef} className="space-y-8">
            <div className="glass-card p-8 rounded-2xl">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-xl font-bold">
                  1
                </div>
                <div>
                  <h3 className="font-heading text-2xl font-semibold mb-2">Bronze Sponsor</h3>
                  <p className="text-zinc-400 mb-4">
                    Support a single project and help one nonprofit transform their operations.
                  </p>
                  <div className="text-lg font-semibold text-[#002FA7]">$5,000+</div>
                </div>
              </div>
            </div>
            <div className="glass-card p-8 rounded-2xl">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-xl font-bold">
                  2
                </div>
                <div>
                  <h3 className="font-heading text-2xl font-semibold mb-2">Silver Sponsor</h3>
                  <p className="text-zinc-400 mb-4">
                    Fund multiple projects and enable a cohort of student developers.
                  </p>
                  <div className="text-lg font-semibold text-[#002FA7]">$15,000+</div>
                </div>
              </div>
            </div>
            <div className="glass-card p-8 rounded-2xl">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-xl font-bold">
                  3
                </div>
                <div>
                  <h3 className="font-heading text-2xl font-semibold mb-2">Gold Sponsor</h3>
                  <p className="text-zinc-400 mb-4">
                    Become a strategic partner and help scale our impact across communities.
                  </p>
                  <div className="text-lg font-semibold text-[#002FA7]">$50,000+</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="glass-card p-12 rounded-3xl">
            <h2 className="font-heading text-4xl font-semibold mb-8">Sponsor Benefits</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-heading text-xl font-semibold mb-3">Brand Visibility</h3>
                <p className="text-zinc-400">
                  Recognition across our platform and events, connecting your brand with 
                  social impact and innovation.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-xl font-semibold mb-3">Talent Pipeline</h3>
                <p className="text-zinc-400">
                  Early access to top student developers for internships and full-time positions.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-xl font-semibold mb-3">Impact Reports</h3>
                <p className="text-zinc-400">
                  Detailed reports on how your sponsorship is creating real-world change.
                </p>
              </div>
              <div>
                <h3 className="font-heading text-xl font-semibold mb-3">Networking</h3>
                <p className="text-zinc-400">
                  Exclusive access to events and connections with nonprofit leaders and innovators.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SmoothScroll>
  );
}

