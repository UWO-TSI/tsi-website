"use client";

import { useState } from "react";

type ProjectCard = {
  name: string;
  description: string;
  details: string;
  image: string; // path to png/jpg
};

// Replace with real assets in /public and update image paths accordingly
const projects: ProjectCard[] = Array.from({ length: 30 }, (_, i) => {
  const id = i + 1;
  return {
    name: `Project ${id}`,
    description: "Short description of the project and outcomes.",
    details: "Additional details about the work delivered for this partner.",
    image: "",
  };
});

export function ProjectCard({ name, description }: { name: string; description: string }) {
  return (
    <article
      className="group flex flex-col rounded-2xl bg-zinc-100 text-zinc-900 shadow-md border border-zinc-200 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.01] transition-all duration-300 ease-out overflow-hidden min-h-[380px]"
    >
      {/* Thumbnail placeholder */}
      <div className="h-48 w-full bg-zinc-300" />

      {/* Body */}
      <div className="flex-1 p-5 space-y-3">
        <div>
          <h3 className="text-xl font-semibold text-zinc-900">{name}</h3>
          <p className="text-sm text-zinc-600 mt-1 leading-relaxed">{description}</p>
        </div>

        <div className="flex gap-2">
          <span className="h-6 min-w-[72px] rounded-full bg-zinc-300" />
          <span className="h-6 min-w-[64px] rounded-full bg-zinc-300" />
          <span className="h-6 min-w-[80px] rounded-full bg-zinc-300" />
        </div>
      </div>

      {/* Footer link */}
      <div className="px-5 pb-4">
        <button className="text-sm font-medium text-blue-700 hover:text-blue-800 transition-colors">
          View Case Study →
        </button>
      </div>
    </article>
  );
}

export default function TemporaryCards() {
  return (
    <div className="max-w-6xl mx-auto px-6 pb-24">
      <div className="flex items-center justify-between mb-10 gap-4">
        <div>
          <h2 className="font-heading text-4xl font-semibold text-white">Recent partner builds</h2>
          <p className="text-zinc-400 mt-2">Hover a card to preview, tap to view the case study.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {projects.map((card) => (
          <ProjectCard key={card.name} name={card.name} description={card.description} />
        ))}
      </div>
    </div>
  );
}
