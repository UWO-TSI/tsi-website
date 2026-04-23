"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  target: Date;
  className?: string;
}

function diffParts(target: Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
} {
  const total = Math.max(0, target.getTime() - Date.now());
  const days = Math.floor(total / (24 * 60 * 60 * 1000));
  const hours = Math.floor((total / (60 * 60 * 1000)) % 24);
  const minutes = Math.floor((total / (60 * 1000)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { days, hours, minutes, seconds, total };
}

export default function Countdown({ target, className = "" }: CountdownProps) {
  const [parts, setParts] = useState(() => diffParts(target));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (parts.total === 0) return null;

  return (
    <span
      className={className}
      aria-label={`${parts.days} days ${parts.hours} hours ${parts.minutes} minutes`}
    >
      <Cell value={parts.days} label="d" />
      <span className="opacity-30 mx-1">:</span>
      <Cell value={parts.hours} label="h" pad />
      <span className="opacity-30 mx-1">:</span>
      <Cell value={parts.minutes} label="m" pad />
      <span className="opacity-30 mx-1">:</span>
      <Cell value={parts.seconds} label="s" pad />
    </span>
  );
}

function Cell({
  value,
  label,
  pad = false,
}: {
  value: number;
  label: string;
  pad?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="font-mono tabular-nums">
        {pad ? String(value).padStart(2, "0") : value}
      </span>
      <span className="text-[8px] opacity-40">{label}</span>
    </span>
  );
}
