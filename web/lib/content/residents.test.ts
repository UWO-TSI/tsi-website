import { describe, expect, it } from "vitest";
import { validateResidentDraft } from "./residents";

describe("residents", () => {
  it("validates resident drafts", () => {
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", post: "wharf_keeper", tone: "dry", bio: "", canned_dialogue: ["Hi."], schedule: { day: "wharf" } })).toEqual([]);
    expect(validateResidentDraft({ slug: "Kit!", display_name: "", post: "wizard", canned_dialogue: [""], schedule: { noon: "wharf" } })).toHaveLength(5);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: "moon" } })).toEqual(["schedule: phase → stop or routine of stops; home → a building"]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { home: "shop", day: ["shop", "pond", "bench"], night: ["bench", "home"] } })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { home: "moon" } })).toHaveLength(1);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: [] } })).toHaveLength(1);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", schedule: { day: ["shop", "shop", "shop", "shop", "shop", "shop", "shop"] } })).toHaveLength(1);
  });

  it("caps the persona prompt on the server too", () => {
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", persona_prompt: "x".repeat(2000) })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", persona_prompt: null })).toEqual([]);
    expect(validateResidentDraft({ slug: "kit", display_name: "Kit", persona_prompt: "x".repeat(2001) })).toEqual(["persona_prompt: up to 2000 characters"]);
  });
});
