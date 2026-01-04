"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Interactive3DCard from "@/components/cards/Interactive3DCard";
import type { PathwayCard } from "@/components/cards/types";

gsap.registerPlugin(ScrollTrigger);

interface WorkProject extends PathwayCard {
  id: string;
  tags: string[];
  year: string;
}

const workProjects: WorkProject[] = [
  {
    id: "1",
    title: "E-Commerce Platform",
    description: "Full-stack marketplace with real-time inventory",
    tags: ["Next.js", "Stripe", "PostgreSQL"],
    year: "2025",
  },
  {
    id: "2",
    title: "AI Dashboard",
    description: "Analytics platform with machine learning insights",
    tags: ["React", "Python", "TensorFlow"],
    year: "2025",
  },
  {
    id: "3",
    title: "Mobile Fitness App",
    description: "iOS and Android workout tracking application",
    tags: ["React Native", "Firebase"],
    year: "2025",
  },
  {
    id: "4",
    title: "SaaS Platform",
    description: "B2B software with team collaboration features",
    tags: ["Vue", "Node.js", "MongoDB"],
    year: "2025",
  },
  {
    id: "5",
    title: "Design System",
    description: "Component library for enterprise applications",
    tags: ["React", "Storybook", "Figma"],
    year: "2025",
  },
];

function ProjectCarousel({ 
  projects, 
  onProjectClick,
  cardWidth = 280,
  cardHeight = 340,
}: { 
  projects: WorkProject[]; 
  onProjectClick: (project: WorkProject) => void;
  cardWidth?: number;
  cardHeight?: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const slide = (direction: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return projects.length - 4;
      if (next > projects.length - 4) return 0;
      return next;
    });
    setTimeout(() => setIsAnimating(false), 500);
  };

  const visibleProjects = projects.slice(currentIndex, currentIndex + 4);

  return (
    <div className="relative h-full flex items-center justify-center">
      <div className="flex gap-6 translate-x-6">
        <AnimatePresence mode="popLayout">
          {visibleProjects.map((project, idx) => (
            <motion.div
              key={`${project.id}-${currentIndex}-${idx}`}
              className="flex-shrink-0"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
            >
              <Interactive3DCard
                title={project.title}
                description={project.description}
                tags={project.tags}
                width={cardWidth}
                height={cardHeight}
                onClick={() => onProjectClick(project)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Carousel Controls */}
      {projects.length > 4 && (
        <div className="absolute -left-4 -right-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
          <button
            onClick={() => slide(-1)}
            disabled={isAnimating}
            className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all disabled:opacity-40 active:scale-95"
          >
            <ChevronLeftIcon className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={() => slide(1)}
            disabled={isAnimating}
            className="pointer-events-auto w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all disabled:opacity-40 active:scale-95"
          >
            <ChevronRightIcon className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

function ProjectModal({ project, onClose }: { project: WorkProject; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-8 relative"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <XMarkIcon className="h-6 w-6 text-white" />
        </button>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <span>{project.year}</span>
            </div>
            <h2 className="text-4xl font-bold text-white">{project.title}</h2>
            <p className="text-xl text-zinc-400">{project.description}</p>
          </div>

          <div className="w-full aspect-[16/9] bg-zinc-800 rounded-xl overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20" />
          </div>

          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-2 text-sm rounded-full bg-zinc-800/50 text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="space-y-4 text-zinc-300">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Challenge</h3>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Solution</h3>
              <p>
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
                ex ea commodo consequat.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Results</h3>
              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                fugiat nulla pariatur.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function WorkSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<WorkProject | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(".work-header", { opacity: 0, y: 20 });
      gsap.set(".carousel-section", { opacity: 0, y: 20 });
      gsap.set(".carousel-section", { opacity: 0, y: 20 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        },
      });

      tl.to(".work-header", {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: "power2.out",
      })
        .to(".work-year", {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
        }, "-=0.3")
        .to(".carousel-section", {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
        }, "-=0.2");
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        className="relative h-screen bg-[#0F0F10] overflow-hidden"
      >
        {/* TITLE */}
        <div className="pt-20 text-center">
          <h2 className="build-title font-heading text-6xl font-semibold mb-4">
            Work
          </h2>
          <p className="build-subtitle text-zinc-400 text-lg">
            2025 Projects
          </p>
        </div>

        {/* CAROUSEL */}
        <div className="absolute inset-x-0 top-[52%] -translate-y-1/2 flex justify-center">
          <div className="carousel-section relative w-[1500px] max-w-[90vw]">
            {/* CARD OFFSET LAYER */}
            <div className="relative">
              <ProjectCarousel
                projects={workProjects}
                onProjectClick={setSelectedProject}
                cardWidth={280}
                cardHeight={340}
              />
            </div>

          </div>
        </div>
      </section>

      {/* MODAL (unchanged) */}
      <AnimatePresence>
        {selectedProject && (
          <ProjectModal
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}