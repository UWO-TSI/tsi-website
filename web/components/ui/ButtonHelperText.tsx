interface ButtonHelperTextProps {
  children: string;
  className?: string;
}

export default function ButtonHelperText({
  children,
  className = "",
}: ButtonHelperTextProps) {
  return (
    <p
      className={`mt-4 max-w-[260px] text-[12px] leading-[1.5] text-[#A1A1AA] text-center ${className}`}
    >
      {children}
    </p>
  );
}