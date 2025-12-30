import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
};

export default function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="font-heading text-5xl md:text-6xl font-semibold mb-4">
        {title}
      </h2>
      {subtitle && (
        <p className="text-zinc-400 text-lg max-w-xl">{subtitle}</p>
      )}
    </div>
  );
}