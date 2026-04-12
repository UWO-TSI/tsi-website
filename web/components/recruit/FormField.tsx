"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { Check, AlertCircle } from "lucide-react";

interface FormFieldProps {
  label: string;
  name: string;
  type?: "text" | "email" | "tel" | "url" | "number" | "select" | "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  options?: { value: string; label: string }[];
  maxLength?: number;
  rows?: number;
  wordCount?: number;
  maxWords?: number;
}

export default function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  error,
  options,
  maxLength,
  rows = 4,
  wordCount,
  maxWords,
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasValue = value.length > 0;
  const isValid = hasValue && !error;

  // Shake animation on error
  useEffect(() => {
    if (error && containerRef.current) {
      gsap.fromTo(
        containerRef.current,
        { x: -5 },
        { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" }
      );
    }
  }, [error]);

  const baseInputClass = `
    w-full rounded-xl bg-white/5 border px-4 py-3 text-sm text-[#F1FFFF]
    placeholder-transparent peer
    focus:outline-none transition-all duration-300
    ${error
      ? "border-[#EF4444]/60 focus:border-[#EF4444] focus:shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"
      : isFocused
        ? "border-[#002FA7] shadow-[0_0_0_2px_rgba(0,47,167,0.3)]"
        : "border-white/10 hover:border-white/20"
    }
  `;

  return (
    <div ref={containerRef} className="relative">
      {type === "select" ? (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          className={`${baseInputClass} appearance-none cursor-pointer`}
        >
          <option value="" disabled>
            {placeholder ?? "Select..."}
          </option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#18181b]">
              {opt.label}
            </option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder ?? label}
          required={required}
          maxLength={maxLength}
          rows={rows}
          className={`${baseInputClass} resize-none`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder ?? label}
          required={required}
          maxLength={maxLength}
          className={baseInputClass}
        />
      )}

      {/* Floating label */}
      <motion.label
        htmlFor={name}
        className="absolute left-4 pointer-events-none font-mono text-xs"
        animate={{
          y: isFocused || hasValue ? -24 : 10,
          scale: isFocused || hasValue ? 0.85 : 1,
          color: error
            ? "#EF4444"
            : isFocused
              ? "#002FA7"
              : "#9CA3AF",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {label}
        {required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </motion.label>

      {/* Validation indicators */}
      <div className="absolute right-3 top-3">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <AlertCircle className="w-4 h-4 text-[#EF4444]" />
            </motion.div>
          )}
          {isValid && !isFocused && (
            <motion.div
              key="valid"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              <Check className="w-4 h-4 text-[#22C55E]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-[#EF4444] mt-1.5 ml-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Word count for essays */}
      {type === "textarea" && maxWords !== undefined && (
        <div className="flex justify-end mt-1">
          <span
            className={`font-mono text-[10px] ${
              (wordCount ?? 0) > maxWords ? "text-[#EF4444]" : "text-[#6B7280]"
            }`}
          >
            {wordCount ?? 0} / {maxWords} words
          </span>
        </div>
      )}
    </div>
  );
}
