"use client";

import SmoothScroll from "@/components/SmoothScroll";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function StudentPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero animation with split text effect
      if (heroRef.current) {
        const title = heroRef.current.querySelector("h1");
        if (title) {
          gsap.fromTo(
            title,
            { opacity: 0, y: 30 },
            { opacity: 1, y: 0, duration: 1, ease: "power3.out" }
          );
        }
      }

      // Features animation
      if (featuresRef.current) {
        const cards = featuresRef.current.children;
        gsap.fromTo(
          cards,
          { opacity: 0, y: 40, rotationY: -15 },
          {
            opacity: 1,
            y: 0,
            rotationY: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: "power2.out",
            scrollTrigger: {
              trigger: featuresRef.current,
              start: "top 75%",
            },
          }
        );
      }

      // Steps animation
      if (stepsRef.current) {
        const steps = stepsRef.current.children;
        gsap.fromTo(
          steps,
          { opacity: 0, x: -30 },
          {
            opacity: 1,
            x: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: stepsRef.current,
              start: "top 80%",
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
        {/* Hero Section - Energetic Layout */}
        <section 
          ref={heroRef}
          className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h1 className="font-heading text-6xl md:text-7xl font-semibold mb-6">
                For Students
              </h1>
              <p className="text-2xl text-zinc-300 mb-4">
                Start a TETHOS Chapter
              </p>
              <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-12">
                Build real-world projects, gain experience, and make a difference 
                in your community. Join a network of student developers creating impact.
              </p>
              <div className="flex gap-4 justify-center">
                <button className="rounded-full bg-[#002FA7] px-8 py-4 text-base font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
                  Start a Chapter
                </button>
                <button className="rounded-full border border-zinc-700 px-8 py-4 text-base font-medium text-zinc-300 transition-all hover:border-zinc-500 hover:text-white">
                  Find Existing Chapter
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="max-w-6xl mx-auto px-6 py-24">
          <h2 className="font-heading text-4xl font-semibold text-center mb-16">
            Why Start a Chapter?
          </h2>
          <div ref={featuresRef} className="grid md:grid-cols-3 gap-8">
            <div className="glass-card p-8 rounded-2xl transform-gpu">
              <div className="text-4xl mb-4">🚀</div>
              <h3 className="font-heading text-2xl font-semibold mb-3">Real Experience</h3>
              <p className="text-zinc-400">
                Work on actual projects for real clients. Build your portfolio with 
                meaningful work that matters.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transform-gpu">
              <div className="text-4xl mb-4">🤝</div>
              <h3 className="font-heading text-2xl font-semibold mb-3">Leadership</h3>
              <p className="text-zinc-400">
                Develop leadership skills by managing teams, projects, and client relationships.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transform-gpu">
              <div className="text-4xl mb-4">🌍</div>
              <h3 className="font-heading text-2xl font-semibold mb-3">Impact</h3>
              <p className="text-zinc-400">
                Make a tangible difference in your community while building your career.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transform-gpu">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="font-heading text-2xl font-semibold mb-3">Networking</h3>
              <p className="text-zinc-400">
                Connect with industry professionals, sponsors, and like-minded developers.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transform-gpu">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="font-heading text-2xl font-semibold mb-3">Learning</h3>
              <p className="text-zinc-400">
                Access workshops, mentorship, and resources to accelerate your growth.
              </p>
            </div>
            <div className="glass-card p-8 rounded-2xl transform-gpu">
              <div className="text-4xl mb-4">🎓</div>
              <h3 className="font-heading text-2xl font-semibold mb-3">Recognition</h3>
              <p className="text-zinc-400">
                Get recognized for your contributions and build a reputation in the tech community.
              </p>
            </div>
          </div>
        </section>

        {/* How to Start */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <h2 className="font-heading text-4xl font-semibold text-center mb-16">
            How to Start a Chapter
          </h2>
          <div ref={stepsRef} className="space-y-6">
            <div className="glass-card p-8 rounded-2xl flex items-start gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-2xl font-bold">
                1
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-2">Gather Your Team</h3>
                <p className="text-zinc-400">
                  Recruit 5-10 committed students who are passionate about technology and social impact.
                </p>
              </div>
            </div>
            <div className="glass-card p-8 rounded-2xl flex items-start gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-2xl font-bold">
                2
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-2">Submit Application</h3>
                <p className="text-zinc-400">
                  Fill out our chapter application with your team details and university information.
                </p>
              </div>
            </div>
            <div className="glass-card p-8 rounded-2xl flex items-start gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-2xl font-bold">
                3
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-2">Get Approved</h3>
                <p className="text-zinc-400">
                  Our team reviews your application and provides onboarding support.
                </p>
              </div>
            </div>
            <div className="glass-card p-8 rounded-2xl flex items-start gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-[#002FA7] flex items-center justify-center font-heading text-2xl font-bold">
                4
              </div>
              <div>
                <h3 className="font-heading text-2xl font-semibold mb-2">Start Building</h3>
                <p className="text-zinc-400">
                  Connect with local nonprofits, receive project assignments, and begin making an impact.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <div className="glass-card p-12 rounded-3xl text-center">
            <h2 className="font-heading text-4xl font-semibold mb-6">
              Ready to Make an Impact?
            </h2>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto">
              Join hundreds of students who are building the future of technology for social good.
            </p>
            <button className="rounded-full bg-[#002FA7] px-8 py-4 text-base font-medium text-[#F1FFFF] transition-all hover:bg-[#0039CC]">
              Apply to Start a Chapter
            </button>
          </div>
        </section>
      </main>
    </SmoothScroll>
  );
}

