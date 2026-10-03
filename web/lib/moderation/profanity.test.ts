import { describe, expect, it } from "vitest";
import { containsProfanity, profanityWords } from "./profanity";

describe("containsProfanity: what the old whole-word list caught still refuses", () => {
  it.each([
    "you are an asshole", "WHAT THE FUCK", "what the fuck", "shit", "bitch please", "you bastard", "cunt", "dick", "pussy", "slut", "whore",
    "fag", "faggot", "retard", "tranny", "kike", "spic", "chink", "gook", "nigger", "nigga",
  ])("%s", (text) => expect(containsProfanity(text)).toBe(true));
});

describe("containsProfanity: real-world bypasses refuse", () => {
  it.each([
    // masks and leetspeak
    "f*ck", "f**k", "fu*k", "sh*t", "sh!t", "sh1t", "$hit", "5hit", "b!tch", "b1tch", "a$$hole", "@sshole", "c*nt", "n1gger", "n!gga", "nigg@",
    "f@g", "fa66ot", "r3tard", "wh0re", "sl*t", "d1ck", "d!ck", "p*ssy", "fu(k", "fu<k", "sh|t", "f#ck", "f%ck", "f🦆ck",
    // separators inside a word, and spaced-out letters
    "f.u.c.k", "f-u-c-k", "f_u_c_k", "f u c k", "F U C K", "s. h. i. t.", "f/u/c/k", "b i t c h", "you are a f u c k i n g joke",
    // repeated letters
    "fuuuuuck", "fuckkkk", "shiiiiit", "niiiigger", "biiiitch",
    // inflections and compounds
    "fucking", "fucker", "motherfucker", "fuckface", "absofuckinglutely", "bullshit", "shithead", "shitty", "bitches", "sluts", "whorehouse",
    "dickhead", "dicks", "faggots", "niggas", "retarded", "fags",
    // look-alike spellings
    "fvck", "phuck", "fuk", "fuk off", "fck", "fcking", "fuq", "biatch", "kunt", "shyt",
    // other scripts, accents and compatibility forms
    "fúck", "ƒuck", "fu\u0441k" /* Cyrillic \u0441 */, "\u0455hit" /* Cyrillic \u0455 */, "𝐟𝐮𝐜𝐤", "𝓯𝓾𝓬𝓴", "ｆｕｃｋ", "ⓕⓤⓒⓚ",
    // invisible characters
    "f\u200buck", "sh\u00adit", "f\u2060u\u200dck", "fu\u202eck",
    // trailing and leading punctuation, digits stuck on, hashtags, possessives
    "dick!", "(dick)", "\"spic\"", "#fuck", "fuck,shit", "dick2000", "2dick", "dick's", "go fuck yourself.",
    // hidden in a longer innocent-looking word after an allowed one
    "scunthorpecunt", "sniggernigger",
  ])("%s", (text) => expect(containsProfanity(text)).toBe(true));
});

describe("containsProfanity: ordinary words don't trip it (the Scunthorpe problem)", () => {
  it.each([
    "Scunthorpe is a place", "class is in session", "assassin", "assess", "passing", "bass", "grass", "harass", "ambassador", "Essex", "Sussex",
    "Dickens", "Dickinson", "Moby Dickson", "cocktail", "cockpit", "peacock", "Hancock", "title", "petite", "spice", "spicy", "conspicuous",
    "spick and span", "chinks in the armour", "snigger", "sniggering", "niggardly", "Niger", "Nigeria", "shiitake",
    "shitake mushrooms", "Ishita", "Ashita", "Kshitij", "Matsushita", "therapist", "analysis", "cumulative", "cucumber", "document", "Penistone",
    "Fukuoka", "Fukushima", "Phuket", "Kuntz", "Cunningham", "bitcoin", "skyscraper", "Uranus", "retardant", "pussycat", "pussyfoot", "shell",
    "hello mayor, how are you today", "Maya Chen", "O'Brien", "Zoë", "李小龙", "",
    // spacing that only looks like spelling
    "if u c kids", "a b c", "I m ok", "u r right", "x y z",
    // numbers, prices, handles, code, emoji
    "2024", "5318008", "$100", "@david", "c++", "C# and F#", "f# minor", "1 2 3 4", "gr8 job", "l8r", "b4 class", "😀🎣", "love❤\ufe0fyou", "hi😀",
    "shoot", "shot", "shut", "sheet", "duck", "deck", "fork", "folk", "fig", "luck", "puck", "buck", "tuck",
  ])("%s", (text) => expect(containsProfanity(text)).toBe(false));
});

describe("how the filter reads a text", () => {
  it("folds, trims, maps and joins one-letter runs", () => {
    expect(profanityWords("Hello, World!")).toEqual(["hello", "world"]);
    expect(profanityWords("W0RLD")).toEqual(["world", "wrld"]);
    expect(profanityWords("f u c k")).toEqual(["f", "u", "c", "k", "fuck"]);
    expect(profanityWords("s.h.i.t")).toEqual(["shit"]);
    expect(profanityWords("dick2000")).toEqual(["dickooo", "dick"]);
    expect(profanityWords("sh*t")).toEqual(["sh?t"]);
  });
  it("only masks up to half a word's letters, and never the first", () => {
    expect(containsProfanity("f***")).toBe(false);
    expect(containsProfanity("*uck")).toBe(false);
    expect(containsProfanity("****")).toBe(false);
    expect(containsProfanity("f??k")).toBe(true);
    expect(containsProfanity("what? really")).toBe(false);
  });
  it("needs a doubled letter twice", () => {
    expect(containsProfanity("niger")).toBe(false);
    expect(containsProfanity("nigger")).toBe(true);
  });
  it("excuses an occurrence only inside the innocent word, not next to it", () => {
    expect(containsProfanity("scunthorpe")).toBe(false);
    expect(containsProfanity("scunthorpe cunt")).toBe(true);
    expect(containsProfanity("shiitakeshit")).toBe(true);
  });
  it("a long ordinary note reads clean, and is quick", () => {
    const note = "Thanks for the help at the bake sale yesterday! The cookies sold out by noon and we raised $340 for the food bank. ".repeat(4);
    const t = performance.now();
    expect(containsProfanity(note)).toBe(false);
    expect(performance.now() - t).toBeLessThan(50);
  });
});
