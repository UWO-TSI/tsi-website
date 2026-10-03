import { describe, expect, it } from "vitest";
import { SIGN_IN, mentionsSignIn, signInHref, splitSignIn } from "./signIn";

describe("sign-in links (reachability deliverable 3)", () => {
  it("go to the sign-in entry with the place you were as `next`", () => {
    expect(SIGN_IN).toBe("/student");
    expect(signInHref("/student/dashboard")).toBe("/student?next=%2Fstudent%2Fdashboard");
    expect(signInHref("/student/companion")).toBe("/student?next=%2Fstudent%2Fcompanion");
    expect(signInHref("/student/companion/study?demo=focus#timer")).toBe(`/student?next=${encodeURIComponent("/student/companion/study?demo=focus#timer")}`);
  });

  it("never send you back to a sign-in page, nor anywhere off the site", () => {
    for (const entry of ["/student", "/student/", "/student/go", "/student/go?next=%2Fstudent%2Fdashboard", "/student/login", "/student/signup"]) expect(signInHref(entry)).toBe("/student");
    for (const bad of ["https://evil.example/x", "//evil.example", "javascript:alert(1)", "/\\evil.example", "student/dashboard", "", null, undefined]) expect(signInHref(bad)).toBe("/student");
  });

  it("find the words to link in a message, whichever case they're in", () => {
    expect(mentionsSignIn("Sign in to open your gift.")).toBe(true);
    expect(mentionsSignIn("Playing offline: sign in to earn the reward.")).toBe(true);
    expect(mentionsSignIn("Sealed. Sign in to enter the ruins.")).toBe(true);
    expect(mentionsSignIn("Signing in is quick.")).toBe(false);
    expect(mentionsSignIn("The gift wouldn't open.")).toBe(false);
    expect(splitSignIn("Playing offline: sign in to earn the reward.")).toEqual(["Playing offline: ", "sign in", " to earn the reward."]);
    expect(splitSignIn("Sign in to see the case")).toEqual(["", "Sign in", " to see the case"]);
    expect(splitSignIn("Nothing here")).toEqual(["Nothing here"]);
  });
});
