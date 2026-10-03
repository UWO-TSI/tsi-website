import { describe, expect, it } from "vitest";
import { cleanChatText, containsLink, isBlankChatText } from "./chatText";

describe("cleanChatText", () => {
  it("collapses whitespace and line breaks, trims", () => {
    expect(cleanChatText("  hello \n\n there\t friend  ")).toBe("hello there friend");
    expect(cleanChatText("a\u00a0b\u3000c\u2003d")).toBe("a b c d");
    expect(cleanChatText("one\u2028two\r\nthree")).toBe("one two three");
  });
  it("drops hidden characters: controls, zero-width spaces, bidi overrides, soft hyphens, fillers", () => {
    expect(cleanChatText("hi\u0000\u0007\u001b[31m there")).toBe("hi[31m there");
    expect(cleanChatText("pay\u200bpal")).toBe("paypal");
    expect(cleanChatText("evil\u202egnp.exe")).toBe("evilgnp.exe");
    expect(cleanChatText("so\u00adft \u2066isolate\u2069")).toBe("soft isolate");
    expect(cleanChatText("\u3164\u115f\u2800")).toBe("");
    expect(cleanChatText("\ufeffbom")).toBe("bom");
  });
  it("keeps emoji sequences, accents and other scripts", () => {
    expect(cleanChatText("👩\u200d💻 café ❤\ufe0f")).toBe("👩\u200d💻 café ❤\ufe0f");
    expect(cleanChatText("می\u200cخواهم")).toBe("می\u200cخواهم");
    expect(cleanChatText("李小龙 Zoë")).toBe("李小龙 Zoë");
    expect(cleanChatText("Cafe\u0301")).toBe("Café"); // NFC
  });
  it("caps stacked marks at three", () => {
    const zalgo = "h" + "\u0301\u0302\u0303\u0304\u0305\u0306\u0307" + "i";
    expect(cleanChatText(zalgo)).toBe("h\u0301\u0302\u0303i");
  });
  it("blank: nothing anyone would see", () => {
    for (const t of ["", " ", "\u0301", "\ufe0f", "\u200d"]) expect(isBlankChatText(t), JSON.stringify(t)).toBe(true);
    for (const t of ["a", ".", "😀", "李"]) expect(isBlankChatText(t)).toBe(false);
  });
});

describe("containsLink", () => {
  it.each([
    "https://example.com", "http://bit.ly", "check ftp://files.example.org/x", "www.example.com", "WWW.EXAMPLE.CO.UK", "example.com",
    "visit example.com now", "discord.gg/abc123", "bit.ly/3xYz", "join my server: discord.gg/xyz", "youtu.be/dQw4w9WgXcQ", "t.me/spam", "free robux at robux.xyz",
    "sub.domain.example.io", "mail me bob@gmail.com", "EXAMPLE.COM", "example。com", "ｅｘａｍｐｌｅ．ｃｏｍ", "192.168.0.1", "go to 10.0.0.5:8080",
    "discord dot gg slash abc", "example (dot) com", "example[.]com", "example [dot] net", "example .com", "my-site.ca", "shop.store", "e\u200bxample.com",
  ])("%s", (text) => expect(containsLink(text)).toBe(true));

  it.each([
    "hello there", "e.g. this", "i.e. that", "U.S.A.", "Mr.Smith", "a.m. or p.m.", "3.14 is pi", "v1.2.3", "node.js and react", "file.txt",
    "That's it.Okay", "I'm home.Today was long", "done. Org meeting tonight", "it's 5:30 at the cafe", "a dot b", "polka dot top", "dot to dot",
    "be there at 7.30", "see you at the com centre", "orgs", ".com", "and/or", "km/h", "w/ friends", "10/10 would fish again",
  ])("%s", (text) => expect(containsLink(text)).toBe(false));
});
