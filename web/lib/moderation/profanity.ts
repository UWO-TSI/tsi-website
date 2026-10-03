/**
 * The word filter for member-written text: world names, letters and notes, table chat, NPC chat and world chat
 * (rows 221, 298). A match refuses the text with a notice; nothing is ever masked or rewritten. Pure TypeScript that
 * imports nothing: the realtime server bundles it too (realtime/tsconfig.json paths `@moderation/*`).
 *
 * How a text is read:
 * 1. Folded: compatibility forms and accents off (NFKD, marks dropped: "𝐟ú𝓬𝓴" and "ｆｕｃｋ" read "fuck"), lower case,
 *    invisible characters gone (zero-width spaces and joiners, soft hyphens, bidi marks), and Cyrillic, Greek and other
 *    look-alike letters read as the Latin letters they imitate.
 * 2. Cut into words at spaces and sentence punctuation. Edge punctuation is trimmed ("dick!" is "dick"). Inside a word,
 *    look-alike digits and symbols read as letters (sh1t, $hit, a$$hole, b!tch, fu(k), separators drop out (f.u.c.k,
 *    f-u-c-k, f_u_c_k) and masks stand for one letter each (f*ck, sh#t, f%ck, an emoji).
 * 3. Runs of three or more one-letter words join up: "f u c k", "s. h. i. t.", "f/u/c/k".
 * 4. Each word is matched against the list. A letter may repeat (fuuuck), but a doubled letter needs two ("niger" isn't
 *    "nigger"); u may be v (fvck); masks may stand in for at most half a word's letters, never its first.
 *    - `inside` entries match anywhere in a word (motherfucker, bullshit), except inside the innocent words listed
 *      with them (Scunthorpe, snigger, niggardly, shiitake, Ishita: the Scunthorpe problem).
 *    - Other entries match whole words only, in the forms listed: "dick" and "dickhead" but not Dickens, "spic" but not
 *      spice, "chink" but not "chinks in the armour", "fuk" but not Fukuoka.
 * Not caught: a word split by spaces into longer pieces ("fu ck"), and words the list doesn't have.
 */

interface Entry {
  forms: string[];
  /** Match anywhere inside a word (else whole words only). */
  inside?: boolean;
  /** Innocent words that contain an `inside` form: an occurrence wholly inside one of them doesn't count. */
  allow?: string[];
}

const LIST: Entry[] = [
  { forms: ["fuck", "phuck"], inside: true },
  { forms: ["fuk", "fuks", "fuker", "fukers", "fuking", "fukin", "fuked", "fuq", "fck", "fcks", "fcker", "fcking", "fckin", "phuk", "phuks"] },
  { forms: ["shit", "shyt"], inside: true, allow: ["shiitake", "shitake", "ishita", "ashita", "kshitij", "matsushita", "yoshita", "hoshita", "shittim", "shittah"] },
  { forms: ["bitch", "biatch", "biotch"], inside: true },
  { forms: ["asshole", "azzhole"], inside: true },
  { forms: ["bastard", "bastards"] },
  { forms: ["cunt"], inside: true, allow: ["scunthorpe"] },
  { forms: ["kunt", "kunts"] },
  { forms: ["dick", "dicks", "dickhead", "dickheads"] },
  { forms: ["pussy", "pussies"] },
  { forms: ["slut"], inside: true },
  { forms: ["whore"], inside: true },
  { forms: ["fag", "fags"] },
  { forms: ["faggot"], inside: true },
  { forms: ["nigger"], inside: true, allow: ["snigger"] },
  { forms: ["nigga"], inside: true, allow: ["niggard"] },
  { forms: ["retard", "retards", "retarded"] },
  { forms: ["tranny", "trannies"] },
  { forms: ["kike", "kikes"] },
  { forms: ["spic", "spics"] },
  { forms: ["chink"] },
  { forms: ["gook", "gooks"] },
];

/** Letters a list letter may also be written as. */
const ALT: Record<string, string> = { u: "uv" };

/** Invisible characters, dropped before reading: soft hyphen, joiners, zero-width and bidi marks, fillers, BOM. */
const INVISIBLE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u2800\u3164\ufe00-\ufe0f\ufeff\uffa0]/g;

/** Letters from other scripts (lower case, after NFKD) that pass for Latin ones. */
const LOOKALIKE: Record<string, string> = {
  // Cyrillic
  "\u0430": "a", "\u0432": "b", "\u0435": "e", "\u0451": "e", "\u0437": "z", "\u0438": "n", "\u0439": "n", "\u043a": "k", "\u043c": "m", "\u043d": "h", "\u043e": "o", "\u043f": "n", "\u0440": "p",
  "\u0441": "c", "\u0442": "t", "\u0443": "y", "\u0445": "x", "\u044c": "b", "\u0455": "s", "\u0456": "i", "\u0457": "i", "\u0458": "j", "\u0501": "d", "\u051b": "q", "\u051d": "w", "\u04af": "y",
  "\u04bb": "h", "\u04cf": "l", "ɡ": "g",
  // Greek
  "\u03b1": "a", "\u03b2": "b", "\u03b3": "y", "\u03b5": "e", "\u03b6": "z", "\u03b7": "n", "\u03b9": "i", "\u03ba": "k", "\u03bc": "u", "\u03bd": "v", "\u03bf": "o", "\u03c1": "p", "\u03c4": "t",
  "\u03c5": "u", "\u03c7": "x", "\u03c9": "w",
  // Latin letters NFKD leaves alone
  "ı": "i", "ł": "l", "ø": "o", "đ": "d", "ħ": "h", "ß": "ss", "æ": "ae", "œ": "oe", "ƒ": "f", "ɑ": "a", "ʋ": "v", "ŧ": "t",
};

/** Digits and symbols that stand for letters inside a word. */
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
  "@": "a", "$": "s", "!": "i", "¡": "i", "|": "i", "+": "t", "€": "e", "¢": "c", "©": "c", "®": "r", "¥": "y", "(": "c", "<": "c", "[": "c", "{": "c",
};

const MASK = "?";
/** What a word is made of: letters, digits, leet and mask symbols, in-word separators, and pictographs (masks too). */
const WORD = /[\p{L}\p{N}$@!¡|+€¢©®¥(<\[{*#%?.\-_'’‘`~^\p{So}]+/gu;
/** Punctuation trimmed from a word's ends ($ and @ stay: "$hit", "@ss"). */
const EDGE = /^[!?¡.\-_'’‘`~^(<\[{*#%|+\p{So}]+|[!?¡.\-_'’‘`~^(<\[{*#%|+\p{So}]+$/gu;
const LETTER = /\p{L}/u;
const DIGIT = /\p{N}/u;
const MASKS = /[*#%?\p{So}]/u;

/** The Latin skeleton of a text, before it's cut into words. */
function fold(text: string): string {
  const folded = text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().replace(INVISIBLE, "");
  let out = "";
  for (const ch of folded) out += LOOKALIKE[ch] ?? ch;
  return out;
}

/**
 * One word as the filter reads it, twice: with look-alike digits as letters ("sh1t"), and with digits dropped
 * ("dick2000"). Masks become MASK; separators and other symbols drop out.
 */
function readWord(raw: string): [string, string] {
  let leet = "", plain = "";
  for (const ch of raw.replace(EDGE, "")) {
    if (LETTER.test(ch)) { leet += ch; plain += ch; }
    else if (DIGIT.test(ch)) leet += LEET[ch] ?? "";
    else if (LEET[ch]) { leet += LEET[ch]; plain += LEET[ch]; }
    else if (MASKS.test(ch)) { leet += MASK; plain += MASK; }
    // Separators (. - _ ' ` ~ ^) and anything else drop out.
  }
  return [leet, plain];
}

/** The words of a text as the filter reads them, with each run of three or more one-letter words joined into one more. */
export function profanityWords(text: string): string[] {
  const words: string[] = [];
  let run = "";
  const endRun = () => {
    if (run.length >= 3) words.push(run);
    run = "";
  };
  for (const m of fold(text).matchAll(WORD)) {
    const [leet, plain] = readWord(m[0]);
    if (!leet) continue; // pure punctuation doesn't break a run of letters
    words.push(leet);
    if (plain && plain !== leet) words.push(plain);
    if ([...leet].length === 1) run += leet;
    else endRun();
  }
  endRun();
  return words;
}

/** A form as a pattern: each letter repeats, a mask may stand in for any letter but the first. */
function pattern(form: string): string {
  return [...form].map((ch, i) => {
    const alt = ALT[ch];
    const letter = alt ? `[${alt}]+` : `${ch}+`;
    return i === 0 ? letter : `(?:${letter}|\\${MASK})`;
  }).join("");
}

interface Compiled { inside: RegExp | null; whole: RegExp | null; forms: number[]; allow: string[] }
const COMPILED: Compiled[] = LIST.map((e) => {
  const alternatives = e.forms.map(pattern).join("|");
  return {
    inside: e.inside ? new RegExp(`(?:${alternatives})`, "g") : null,
    whole: e.inside ? null : new RegExp(`^(?:${alternatives})$`),
    forms: e.forms.map((f) => f.length),
    allow: e.allow ?? [],
  };
});

const masks = (s: string) => s.split(MASK).length - 1;
/** At most half a form's letters may be masks (the shortest form an entry has). */
const tooMasked = (match: string, c: Compiled) => masks(match) > Math.floor(Math.min(...c.forms) / 2);

/** Is the occurrence at [start, end) wholly inside one of the entry's innocent words in `word`? */
function excused(word: string, start: number, end: number, allow: readonly string[]): boolean {
  for (const a of allow) {
    for (let i = word.indexOf(a); i >= 0; i = word.indexOf(a, i + 1)) if (i <= start && end <= i + a.length) return true;
  }
  return false;
}

function matches(word: string, c: Compiled): boolean {
  if (c.whole) return c.whole.test(word) && !tooMasked(word, c);
  const re = c.inside!;
  re.lastIndex = 0;
  for (let m = re.exec(word); m; m = re.exec(word)) {
    if (!tooMasked(m[0], c) && !excused(word, m.index, m.index + m[0].length, c.allow)) return true;
    re.lastIndex = m.index + 1;
  }
  return false;
}

export function containsProfanity(text: string): boolean {
  if (!text) return false;
  for (const word of profanityWords(text)) for (const c of COMPILED) if (matches(word, c)) return true;
  return false;
}
