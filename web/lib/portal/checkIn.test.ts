import { describe, expect, it } from "vitest";
import { checkIn, checkInPath, checkInUrl } from "./checkIn";

const E = "00000000-0000-4000-8000-0000000000e1";
const C = "00000000-0000-4000-8000-0000000000c1";
const answer = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("event check-in links and results (#26)", () => {
  it("the QR points at tethos.ca's check-in page with the event and its code", () => {
    expect(checkInUrl(E, C)).toBe(`https://www.tethos.ca/student/check-in?event=${E}&code=${C}`);
    expect(checkInPath(E, C)).toBe(`/student/check-in?event=${E}&code=${C}`);
  });
  it("reads the route's answers", async () => {
    expect(await checkIn(E, C, answer(200, { ok: true, event: { title: "Fall social", is_irl: true }, already: false }))).toEqual({ kind: "done", title: "Fall social", irl: true, already: false });
    expect(await checkIn(E, C, answer(200, { ok: true, event: { title: "Fall social", is_irl: true }, already: true }))).toMatchObject({ kind: "done", already: true });
    expect(await checkIn(E, C, answer(401, { ok: false, error: "Unauthorized" }))).toEqual({ kind: "signed-out" });
    expect(await checkIn(E, C, answer(403, { ok: false, error: "That code isn’t this event’s.", code: "wrong_code" }))).toEqual({ kind: "refused", message: "That code isn’t this event’s." });
    expect(await checkIn(E, C, answer(404, { ok: false, error: "We couldn’t find that event." }))).toEqual({ kind: "refused", message: "We couldn’t find that event." });
    expect(await checkIn(E, C, answer(503, { ok: false, error: "Not available yet." }))).toEqual({ kind: "error" });
    expect(await checkIn(E, C, (async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch)).toEqual({ kind: "error" });
  });
});
