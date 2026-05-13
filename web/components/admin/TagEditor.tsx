"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  // Signal
  "strong candidate",
  "top pick",
  "shortlist",
  "follow up",
  "needs review",
  "maybe",
  "pass",
  // Strengths
  "experienced",
  "technical",
  "leadership",
  "creative",
  "strategic",
  "ops minded",
  "communicator",
  "design eye",
  "writes well",
  "ships fast",
  // Background
  "returning member",
  "alumni referral",
  "referral",
  "western",
  "ivey",
  "engineering",
  "first year",
  "senior",
  // Risk / fit
  "schedule risk",
  "culture fit",
  "needs interview",
  "interviewed",
  "second round",
];

export default function TagEditor({
  tags,
  onChange,
  suggestions = DEFAULT_SUGGESTIONS,
}: TagEditorProps) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !tags.includes(s) &&
      s.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="relative">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 text-[10px] font-mono text-[#F1FFFF]"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="hover:text-[#EF4444] transition"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Add tag..."
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0] transition"
        />

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 top-full mt-1 w-full max-h-56 overflow-y-auto rounded-lg bg-[#18181b] border border-white/10 shadow-lg">
            {filteredSuggestions.slice(0, 12).map((s) => (
              <button
                key={s}
                onMouseDown={() => addTag(s)}
                className="w-full text-left px-3 py-1.5 text-xs text-[#9CA3AF] hover:text-[#F1FFFF] hover:bg-white/5 transition flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
