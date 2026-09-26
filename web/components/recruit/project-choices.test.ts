import { describe, expect, it } from "vitest";
import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import {
  MAX_PROJECT_CHOICES,
  projectChoiceAnswer,
  sanitizeProjectChoices,
  toggleProjectChoice,
} from "./project-choices";

const [first, second, third, fourth] = DEVELOPER_PROJECTS.map((p) => p.partner);

describe("toggleProjectChoice", () => {
  it("appends picks in click order up to the cap", () => {
    let choices: string[] = [];
    for (const partner of [first, second, third]) choices = toggleProjectChoice(choices, partner);
    expect(choices).toEqual([first, second, third]);
    expect(toggleProjectChoice(choices, fourth)).toEqual(choices);
  });
  it("unranking compacts the order so 1st/2nd/3rd stay contiguous", () => {
    expect(toggleProjectChoice([first, second, third], second)).toEqual([first, third]);
  });
});

describe("sanitizeProjectChoices", () => {
  it("keeps only known partners, deduped, capped", () => {
    expect(sanitizeProjectChoices([first, "Not a project", first, second, third, fourth]))
      .toEqual([first, second, third]);
  });
  it("rejects non-array drafts and non-string entries", () => {
    expect(sanitizeProjectChoices("nope")).toEqual([]);
    expect(sanitizeProjectChoices([42, null, { partner: first }])).toEqual([]);
    expect(MAX_PROJECT_CHOICES).toBe(3);
  });
});

describe("projectChoiceAnswer", () => {
  it("includes the project title reviewers know", () => {
    const project = DEVELOPER_PROJECTS[0];
    expect(projectChoiceAnswer(project.partner)).toBe(`${project.partner} (${project.title})`);
  });
  it("falls back to the raw partner for unknown values", () => {
    expect(projectChoiceAnswer("Legacy Partner")).toBe("Legacy Partner");
  });
});
