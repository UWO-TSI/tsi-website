"use client";

import { useState } from "react";
import { Search } from "lucide-react";
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
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px] max-w-[400px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          placeholder="Search name or email"
          className="w-full pl-9 pr-3 py-2 rounded-full bg-white/[0.04] border border-white/10 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0]/50 focus:bg-white/[0.06] transition"
        />
      </div>

      <div className="flex items-center gap-1 ml-auto md:ml-0">
        <ChipSelect
          value={filters.role}
          options={[
            { value: "", label: "All roles" },
            ...positions.map((p) => ({ value: p.slug, label: p.title })),
          ]}
          onChange={(v) => update("role", v)}
        />
        <ChipSelect
          value={filters.status}
          options={[
            { value: "", label: "All statuses" },
            ...APPLICATION_STATUSES.map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            })),
          ]}
          onChange={(v) => update("status", v)}
        />
        <input
          type="text"
          value={filters.tag}
          onChange={(e) => update("tag", e.target.value)}
          placeholder="Tag…"
          className="rounded-full bg-white/[0.04] border border-white/10 px-3 py-1.5 text-xs text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0]/50 focus:bg-white/[0.06] transition w-[100px]"
        />
      </div>
    </div>
  );
}

interface ChipOption {
  value: string;
  label: string;
}

function ChipSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ChipOption[];
  onChange: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  const isActive = value !== "";
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none cursor-pointer outline-none rounded-full px-3 py-1.5 text-xs transition pr-7"
        style={{
          background: isActive
            ? "rgba(29,155,240,0.12)"
            : "rgba(255,255,255,0.04)",
          border: isActive
            ? "1px solid rgba(29,155,240,0.4)"
            : "1px solid rgba(255,255,255,0.10)",
          color: isActive ? "#1D9BF0" : "#F1FFFF",
          fontFamily: "var(--font-highlight)",
        }}
      >
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className="bg-[#18181b] text-[#F1FFFF]"
          >
            {opt.label}
          </option>
        ))}
      </select>
      {/* Caret */}
      <svg
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Hidden span to keep tooltip / current label accessible */}
      <span className="sr-only">{current.label}</span>
    </div>
  );
}
