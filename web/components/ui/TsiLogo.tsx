import { PEOPLE } from "@/components/site/marks";

interface TsiLogoProps {
  className?: string;
  width?: number;
  height?: number;
}

export default function TsiLogo({ className = "", width = 32, height = 32 }: TsiLogoProps) {
  return (
    <svg width={width} height={height} viewBox="0 0 1410 1352" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {PEOPLE.map((p, i) => (
        <path key={i} d={p.d} fill="currentColor" fillRule={p.evenodd ? "evenodd" : undefined} clipRule={p.evenodd ? "evenodd" : undefined} />
      ))}
    </svg>
  );
}
