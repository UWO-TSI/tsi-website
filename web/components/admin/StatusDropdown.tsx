"use client";

import { APPLICATION_STATUSES, STATUS_LABELS, STATUS_COLORS, type ApplicationStatus } from "@/lib/recruitment";

interface StatusDropdownProps {
  currentStatus: ApplicationStatus;
  draftStatus: ApplicationStatus | null;
  onChange: (status: ApplicationStatus) => void;
}

export default function StatusDropdown({
  currentStatus,
  draftStatus,
  onChange,
}: StatusDropdownProps) {
  const displayStatus = draftStatus ?? currentStatus;
  const hasChange = draftStatus && draftStatus !== currentStatus;

  return (
    <div className="relative">
      <select
        value={displayStatus}
        onChange={(e) => onChange(e.target.value as ApplicationStatus)}
        className="rounded-lg bg-white/5 border px-3 py-1.5 text-xs font-mono text-[#F1FFFF] focus:outline-none transition appearance-none cursor-pointer pr-8"
        style={{
          borderColor: hasChange
            ? `${STATUS_COLORS[displayStatus]}60`
            : "rgba(255,255,255,0.1)",
        }}
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s} className="bg-[#18181b]">
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {hasChange && (
        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FFD166]" />
      )}
    </div>
  );
}
