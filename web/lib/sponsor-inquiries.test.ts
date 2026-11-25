import { describe, expect, it } from "vitest";
import { inquiryEmail, sponsorInquiryInput } from "./sponsor-inquiries";

const valid = { name: "Ada Lovelace", organization: "Analytical Co", email: " Ada@Example.com ", interests: ["hiring", "stage"], message: "" };

describe("sponsorInquiryInput", () => {
  it("accepts the short form and tidies it", () => {
    const r = sponsorInquiryInput.parse(valid);
    expect(r.email).toBe("ada@example.com");
    expect(r.message).toBeNull();
    expect(r.interests).toEqual(["hiring", "stage"]);
  });
  it("needs a name, an organization and an email", () => {
    expect(sponsorInquiryInput.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(sponsorInquiryInput.safeParse({ ...valid, organization: "" }).success).toBe(false);
    expect(sponsorInquiryInput.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });
  it("rejects unknown interests and a filled honeypot", () => {
    expect(sponsorInquiryInput.safeParse({ ...valid, interests: ["yachts"] }).success).toBe(false);
    expect(sponsorInquiryInput.safeParse({ ...valid, company_fax: "555" }).success).toBe(false);
  });
});

describe("inquiryEmail", () => {
  it("names the sponsor and what they ticked", () => {
    const { company_fax, ...body } = sponsorInquiryInput.parse({ ...valid, message: "Call me." });
    void company_fax;
    const mail = inquiryEmail(body);
    expect(mail.subject).toBe("GENESIS sponsor inquiry: Analytical Co");
    expect(mail.text).toContain("Interested in: Meeting students to hire, Speaking or a workshop at GENESIS");
    expect(mail.text).toContain("Call me.");
  });
});
