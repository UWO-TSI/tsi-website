import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DevUiTheme } from "@/components/gui/DevUiTheme";

// Every /dev harness is local-only; production builds 404 them (the playground has no check of its own).
export default function DevLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <><DevUiTheme />{children}</>;
}
