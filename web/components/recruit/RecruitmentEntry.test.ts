import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({ formOnly: false, query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("next/dynamic", () => ({ default: () => () => "applicant-world" }));
vi.mock("./ApplicantLoading", () => ({ default: () => "loading" }));
vi.mock("./RecruitmentLanding", () => ({ default: () => "direct-applications" }));
vi.mock("./useFormOnly", () => ({ useFormOnly: () => state.formOnly }));
import RecruitmentEntry from "./RecruitmentEntry";

describe("recruitment entry", () => {
  beforeEach(() => { state.formOnly = false; state.query = ""; });
  it("enters the applicant world by default on laptops", () => {
    expect(renderToStaticMarkup(createElement(RecruitmentEntry))).toBe("applicant-world");
  });
  it("keeps mobile and reduced-motion entry on direct applications", () => {
    state.formOnly = true;
    expect(renderToStaticMarkup(createElement(RecruitmentEntry))).toBe("direct-applications");
  });
  it("honors the world's explicit direct-form escape", () => {
    state.query = "view=form";
    expect(renderToStaticMarkup(createElement(RecruitmentEntry))).toBe("direct-applications");
  });
});
