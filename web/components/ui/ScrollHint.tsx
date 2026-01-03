import ScrollIndicator from "@/components/ui/ScrollIndicator";

interface ScrollHintProps {
  label: string;
}

export function ScrollHint({ label }: ScrollHintProps) {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
      <ScrollIndicator />
      <span className="text-xs font-light text-[#A1A1AA]">
        {label}
      </span>
    </div>
  );
}