import { describe, expect, it } from "vitest";
import { previewRecruitmentPositions } from "./recruitment-round";
import { validatePositionAnswers, type ApplicationInput } from "./recruitment-validation";
import type { Position } from "./recruitment";

const userId = "11111111-1111-4111-8111-111111111111";
const roles = previewRecruitmentPositions();
const role = (slug: string) => roles.find(position => position.slug === slug)!;
function inputFor(position: Position): ApplicationInput {
  return {
    position_id: position.id,
    full_name: "Test Applicant",
    email: "applicant@example.invalid",
    phone: "",
    program_major: "Engineering",
    year_of_study: 2,
    heard_about_us: "Website",
    resume_storage_path: `${userId}/resume.pdf`,
    resume_filename: "resume.pdf",
    essay_answers: position.essay_questions.map(question => ({
      question_id: question.id,
      answer: question.response_type === "url" ? "https://example.invalid/work" : "My answer",
    })),
  };
}

describe("final director and developer question contracts", () => {
  it("allows the optional Marketing portfolio to be absent, empty or whitespace", () => {
    const position = role("director-marketing");
    const input = inputFor(position);
    const withoutPortfolio = input.essay_answers.filter(answer => answer.question_id !== "marketing-portfolio");
    expect(validatePositionAnswers({ ...input, essay_answers: withoutPortfolio }, position, userId)).toBeNull();
    for (const answer of ["", "   "]) {
      expect(validatePositionAnswers({ ...input, essay_answers: [...withoutPortfolio, { question_id: "marketing-portfolio", answer }] }, position, userId)).toBeNull();
    }
  });

  it("still validates optional portfolio URLs when supplied and requires all other Marketing answers", () => {
    const position = role("director-marketing");
    const input = inputFor(position);
    for (const answer of ["my portfolio", "javascript:alert(1)"]) {
      input.essay_answers.find(value => value.question_id === "marketing-portfolio")!.answer = answer;
      expect(validatePositionAnswers(input, position, userId)).toContain("valid http or https link");
    }
    input.essay_answers.find(value => value.question_id === "marketing-portfolio")!.answer = "https://example.invalid/portfolio";
    expect(validatePositionAnswers(input, position, userId)).toBeNull();
    for (const question of position.essay_questions.filter(value => value.required !== false)) {
      expect(validatePositionAnswers({ ...input, essay_answers: input.essay_answers.filter(value => value.question_id !== question.id) }, position, userId)).toContain("Please answer:");
    }
  });

  it("accepts the developer's optional project ranking meta answers", () => {
    const position = role("developer");
    const input = inputFor(position);
    input.essay_answers.push(
      { question_id: "__project_choice_1", answer: "Boys and Girls Club London (MAP Program App)" },
      { question_id: "__project_choice_2", answer: "Growing Chefs! (Dietary Restriction System)" },
      { question_id: "__project_choice_3", answer: "ArkAid (Kitchen Dashboard)" },
      { question_id: "__project_choice_reason", answer: "I care about food security." },
    );
    expect(validatePositionAnswers(input, position, userId)).toBeNull();
    input.essay_answers.push({ question_id: "__project_choice_4", answer: "no such rank" });
    expect(validatePositionAnswers(input, position, userId)).toBe("Unknown application question");
  });

  it("requires Internal's new persuasion answer and reel link independently", () => {
    const position = role("director-internal");
    const input = inputFor(position);
    expect(validatePositionAnswers(input, position, userId)).toBeNull();
    for (const id of ["internal-pedicure-persuasion", "internal-reel"]) {
      expect(validatePositionAnswers({ ...input, essay_answers: input.essay_answers.filter(answer => answer.question_id !== id) }, position, userId)).toContain("Please answer:");
    }
    input.essay_answers.find(value => value.question_id === "internal-reel")!.answer = "a funny reel";
    expect(validatePositionAnswers(input, position, userId)).toContain("valid http or https link");
  });

  it("enforces each finalized essay's exact word limit", () => {
    for (const position of roles) {
      for (const question of position.essay_questions.filter(value => value.response_type !== "url")) {
        const input = inputFor(position);
        const answer = input.essay_answers.find(value => value.question_id === question.id)!;
        answer.answer = Array(question.max_words).fill("word").join(" ");
        expect(validatePositionAnswers(input, position, userId), question.id).toBeNull();
        answer.answer += " word";
        expect(validatePositionAnswers(input, position, userId), question.id).toContain(`exceeds ${question.max_words} words`);
      }
    }
    expect(role("director-marketing").essay_questions.map(question => question.max_words)).toEqual([150, 1, 200, 150]);
    expect(role("developer").essay_questions.map(question => question.max_words)).toEqual([150, 150, 150, 150]);
    expect(role("director-external").essay_questions.map(question => question.max_words)).toEqual([250, 250, 250, 250]);
  });

  it("rejects superseded question IDs so old draft answers cannot silently answer new prompts", () => {
    for (const [slug, question_id] of [["developer", "developer-1"], ["director-internal", "internal-short-link"]]) {
      const position = role(slug);
      const input = inputFor(position);
      input.essay_answers.push({ question_id, answer: "Previous answer" });
      expect(validatePositionAnswers(input, position, userId)).toBe("Unknown application question");
    }
  });
});
