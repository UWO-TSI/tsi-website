import Button from "@/components/ui/Button";
import ButtonHelperText from "@/components/ui/ButtonHelperText";

type HeroCTAProps = {
  label: string;
  helperText: string;
  variant?: "primary" | "secondary";
};

export default function HeroCTA({
  label,
  helperText,
  variant = "primary",
}: HeroCTAProps) {
  return (
    <div className="flex flex-col items-center w-[260px]">
      <Button variant={variant}>{label}</Button>
      <div className="mt-3 min-h-[40px]">
        <ButtonHelperText>{helperText}</ButtonHelperText>
      </div>
    </div>
  );
}