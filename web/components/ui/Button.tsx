"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
}

export default function Button({
  children,
  variant = "primary",
  className,
  onClick,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full px-8 py-4 text-[14px] font-medium transition",
        variant === "primary" &&
          "bg-[#002FA7] text-[#F1FFFF] hover:bg-[#0039CC]",
        variant === "secondary" &&
          "bg-zinc-400/20 text-white hover:bg-zinc-400/30",
        className
      )}
    >
      {children}
    </button>
  );
}