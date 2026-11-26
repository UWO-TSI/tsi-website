import { describe, expect, it } from "vitest";
import { fakeDb } from "@/lib/portal/testDb";
import { matchRegistration, parseLumaCsv } from "./luma";

describe("the Luma guest list", () => {
  it("reads Luma's export, skipping declined, waitlisted and bad rows", () => {
    const csv = '﻿api_id,name,first_name,last_name,email,approval_status\r\n'
      + 'g1,"Lee, Ada",Ada,Lee,Ada@Example.com,approved\r\n'
      + 'g2,Bo,Bo,,bo@example.com,declined\r\n'
      + 'g3,Cy,Cy,,not-an-email,approved\r\n'
      + 'g4,Di,Di,,di@example.com,waitlist\r\n'
      + 'g5,Ada again,,,ada@example.com,approved\r\n';
    expect(parseLumaCsv(csv)).toEqual([{ email: "ada@example.com", name: "Ada again" }]);
    expect(parseLumaCsv("first_name,last_name,email\nEd,Ng,ed@x.ca\n")).toEqual([{ email: "ed@x.ca", name: "Ed Ng" }]);
    expect(parseLumaCsv("name\nx\n")).toEqual([]);
  });
  it("links a saved pass to its registration and fills a missing name", async () => {
    const f = fakeDb({ genesis_registrations: [{ email: "ada@example.com", name: "Ada Lee", pass_id: null }], genesis_passes: [{ id: "p1", name: null }] });
    await matchRegistration(f.db, "p1", "ADA@example.com");
    expect(f.tables.genesis_registrations[0].pass_id).toBe("p1");
    expect(f.tables.genesis_passes[0].name).toBe("Ada Lee");
  });
});
