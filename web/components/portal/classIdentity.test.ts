import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FAMILIES } from "@/lib/game/oracle/family";
import { CLASS_META, ClassBadge } from "./classIdentity";

describe("class badges after the 034 families", () => {
  it("render every family in its colour", () => {
    for (const [family, { color }] of Object.entries(FAMILIES)) {
      const html = renderToStaticMarkup(createElement(ClassBadge, { cls: family }));
      expect(html).toContain(family);
      expect(html).toContain(color);
    }
    expect(Object.keys(CLASS_META)).toEqual(Object.keys(FAMILIES));
  });
});
