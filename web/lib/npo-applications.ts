import { z } from "zod";
import { inNpoWindow, NPO_WINDOW } from "@/lib/site/season";

export const ORG_TYPES = [
  { value: "registered_charity", label: "Registered charity" },
  { value: "nonprofit", label: "Nonprofit organization" },
  { value: "social_enterprise", label: "Social enterprise" },
  { value: "other", label: "Something else" },
] as const;

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).optional().transform((v) => (v ? v : null));

export const npoApplicationInput = z.object({
  org_name: text(200).min(1),
  website: optional(300),
  org_type: z.enum(["registered_charity", "nonprofit", "social_enterprise", "other"]),
  city: optional(120),
  contact_name: text(160).min(1),
  contact_email: z.string().trim().toLowerCase().email().max(254),
  contact_role: optional(160),
  problem: text(4000).min(20),
  users: optional(2000),
  current_tools: optional(2000),
  can_commit: z.boolean(),
  heard_about: optional(200),
  // Left empty by people; bots fill every field.
  company_fax: z.string().max(0).optional(),
});

export type NpoApplicationInput = z.infer<typeof npoApplicationInput>;

/** Preview deployments stay open so the form can be tried outside August; their rows are marked "preview". */
export const isPreviewDeployment = () => process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";

export function npoFormOpen(now = new Date()): boolean {
  return isPreviewDeployment() || inNpoWindow(now);
}

/** The program year an application in this August is for: Aug 2027 applies to the 2027-28 build. */
export function npoCycle(now = new Date()): string {
  if (isPreviewDeployment()) return "preview";
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric" }).format(now));
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

export const NPO_WINDOW_LABEL = `Aug ${NPO_WINDOW.opens.day} to Aug ${NPO_WINDOW.closes.day}`;
