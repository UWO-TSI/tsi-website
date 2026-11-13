import { z } from "zod";

/** What a sponsor can tick on the /genesis form: what sponsors get (SPONSOR_GETS), in a few words. */
export const SPONSOR_INTERESTS = [
  { value: "recognition", label: "Our name on the work" },
  { value: "hiring", label: "Meeting students to hire" },
  { value: "stage", label: "Speaking or a workshop at GENESIS" },
  { value: "unsure", label: "Not sure yet" },
] as const;

/** Who gets each inquiry by email: the sponsorship leads. */
export const SPONSORSHIP_LEADS = ["jgao537@uwo.ca", "slin542@uwo.ca"];

const text = (max: number) => z.string().trim().max(max);

export const sponsorInquiryInput = z.object({
  name: text(160).min(1),
  organization: text(200).min(1),
  email: z.string().trim().toLowerCase().email().max(254),
  interests: z.array(z.enum(["recognition", "hiring", "stage", "unsure"])).max(4).default([]),
  message: text(2000).optional().transform((v) => (v ? v : null)),
  // Left empty by people; bots fill every field.
  company_fax: z.string().max(0).optional(),
});

export type SponsorInquiryInput = z.infer<typeof sponsorInquiryInput>;

/** The email the sponsorship leads get; replying goes straight to the sponsor. */
export function inquiryEmail(i: Omit<SponsorInquiryInput, "company_fax">) {
  const interests = i.interests.map((v) => SPONSOR_INTERESTS.find((s) => s.value === v)?.label ?? v);
  return {
    subject: `GENESIS sponsor inquiry: ${i.organization}`,
    text: [
      `${i.name} from ${i.organization} filled in the sponsor form on tethos.ca/genesis.`,
      "",
      `Email: ${i.email}`,
      `Interested in: ${interests.length ? interests.join(", ") : "not said"}`,
      ...(i.message ? ["", i.message] : []),
      "",
      "Reply to this email to answer them.",
    ].join("\n"),
  };
}
