"use client";

import { useState } from "react";



import PositionedCard from "@/components/cards/PositionedCard";



export default function TestimonialsSection() {
  // Example testimonial cards for the carousel
  const testimonials = [
    {
      title: "Alice Johnson",
      subtitle: "Executive Director, Helping Hands",
      href: "#",
      quote: "TETHOS delivered a platform that transformed our outreach. Their team is professional, creative, and truly cares about impact.",
      avatar: "/public/models/alice.jpg",
    },
    {
      title: "Brian Lee",
      subtitle: "CTO, GreenTech",
      href: "#",
      quote: "The collaboration was seamless. We launched on time and exceeded our goals. Highly recommend working with TETHOS!",
      avatar: "/public/models/brian.jpg",
    },
    {
      title: "Carla Gomez",
      subtitle: "Founder, EduBridge",
      href: "#",
      quote: "Our student engagement doubled after TETHOS revamped our digital presence. The process was smooth and inspiring.",
      avatar: "/public/models/carla.jpg",
    },
    {
      title: "David Kim",
      subtitle: "Program Manager, Code4Good",
      href: "#",
      quote: "TETHOS brought our vision to life with empathy and technical excellence. We felt supported every step of the way.",
      avatar: "/public/models/david.jpg",
    },
    {
      title: "Emma Patel",
      subtitle: "Director, YouthSpark",
      href: "#",
      quote: "From ideation to launch, TETHOS was a true partner. Their work ethic and results speak for themselves.",
      avatar: "/public/models/emma.jpg",
    },
  ];

  return (
    <div className="min-h-screen font-sans relative isolate overflow-hidden bg-gradient-to-b from-[#0F0F10] via-[#181B1B] to-[#111113] text-white">
      <main className="max-w-6xl mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-screen text-center mb - 10">
        <h1 className="font-heading text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl mb-4">
          Hear From the Nonprofits We’ve Worked With
        </h1>
        <p className="mt-2 max-w-3xl text-base text-gray-400 sm:text-lg md:text-xl mb-8">
          Real stories from organizations who partnered with TETHOS for technical support, digital transformation, and long-term impact.
        </p>
        {/* Testimonial Cards */}
        <div className="w-full flex flex-nowrap overflow-x-auto gap-8 mt-8 pb-4 justify-start items-stretch">
          {testimonials.map((testimonial, idx) => (
            <div key={testimonial.title + idx} className="max-w-sm min-w-[320px] flex-shrink-0">
              <PositionedCard card={testimonial} index={0} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
