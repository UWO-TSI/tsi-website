import { describe, expect, it } from "vitest";
import { sheetIdFrom } from "./attendance-sheet";

describe("sheetIdFrom", () => {
  it("reads the id out of a pasted Google Sheets link, and nothing else", () => {
    const id = "1AbC-dEf_GhIjKlMnOpQrStUvWxYz0123456789ab";
    expect(sheetIdFrom(`https://docs.google.com/spreadsheets/d/${id}/edit#gid=0`)).toBe(id);
    expect(sheetIdFrom(`  https://docs.google.com/spreadsheets/d/${id}  `)).toBe(id);
    expect(sheetIdFrom("https://docs.google.com/document/d/abc/edit")).toBeNull();
    expect(sheetIdFrom("not a link")).toBeNull();
  });
});
