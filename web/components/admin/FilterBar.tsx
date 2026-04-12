"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { APPLICATION_STATUSES, STATUS_LABELS } from "@/lib/recruitment";

interface FilterBarProps {
  positions: { slug: string; title: string }[];
  onFilterChange: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  role: string;
  status: string;
  tag: string;
}

export default function FilterBar({ positions, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    role: "",
    status: "",
    tag: "",
  });

  const update = (key: keyof FilterState, value: string) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    onFilterChange(next);
  };

  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#002FA7] transition"
          />
        </div>

        {/* Role filter */}
        <select
          value={filters.role}
          onChange={(e) => update("role", e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F1FFFF] focus:outline-none focus:border-[#002FA7] transition appearance-none cursor-pointer"
        >
          <option value="" className="bg-[#18181b]">All Roles</option>
          {positions.map((p) => (
            <option key={p.slug} value={p.slug} className="bg-[#18181b]">
              {p.title}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => update("status", e.target.value)}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F1FFFF] focus:outline-none focus:border-[#002FA7] transition appearance-none cursor-pointer"
        >
          <option value="" className="bg-[#18181b]">All Statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s} className="bg-[#18181b]">
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Tag search */}
        <input
          type="text"
          value={filters.tag}
          onChange={(e) => update("tag", e.target.value)}
          placeholder="Filter by tag..."
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#002FA7] transition w-[140px]"
        />
      </div>
    </div>
  );
}
