"use client";

import { ReactNode } from "react";
import clsx from "clsx";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export default function Button({
  children,
  variant = "primary",
  className,
  onClick,
  disabled = false,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "rounded-full px-8 py-4 text-[14px] font-medium transition",
        !disabled &&
          variant === "primary" &&
          "bg-[#002FA7] text-[#F1FFFF] hover:bg-[#0039CC]",
        !disabled &&
          variant === "secondary" &&
          "bg-zinc-400/20 text-white hover:bg-zinc-400/30",
        disabled && "bg-white/5 text-[#6B7280] cursor-not-allowed",
        className
      )}
    >
      {children}
    </button>
  );
}
