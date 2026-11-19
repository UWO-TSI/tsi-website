"use client";

/**
 * The creator's look (ledger row 334): the member game's is the flat kit's, always. The applicant island hands in its own
 * studio (components/recruit/applicantStudio.ts: recruitment's cream classes and button), so its creator stays exactly
 * as it was without any cream living in the game's code. CharacterCreator provides it; its controls read it here.
 */
import { createContext, useContext, type ButtonHTMLAttributes, type ComponentType } from "react";
import { Button } from "@/components/gui";
import flatStyles from "./CharacterCreator.module.css";

export type StudioButton = ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger" }>;
export interface ApplicantStudio { styles: Readonly<Record<string, string>>; Button: StudioButton }
export const StudioContext = createContext<ApplicantStudio | null>(null);

/** The creator's classes and button: the applicant island's studio inside one, else the flat kit's. */
export function useStudio(): { styles: Readonly<Record<string, string>>; Button: StudioButton; applicant: boolean } {
  const studio = useContext(StudioContext);
  return { styles: studio?.styles ?? flatStyles, Button: studio?.Button ?? Button, applicant: !!studio };
}
