import type { ReactNode } from "react";

export const metadata = {
  title: "Recruitment Admin | Tethos",
  description: "Admin dashboard for reviewing recruitment applications.",
};

export default function AdminRecruitLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">{children}</div>
  );
}
