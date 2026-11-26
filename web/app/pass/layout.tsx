import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./pass.css";

export const metadata: Metadata = { title: { default: "GENESIS pass", template: "%s | GENESIS" }, robots: { index: false } };
export const viewport: Viewport = { themeColor: "#0f0f10", width: "device-width", initialScale: 1 };

export default function PassLayout({ children }: { children: ReactNode }) {
  return <main className="gp">{children}</main>;
}
