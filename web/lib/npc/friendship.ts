/**
 * Resident friendship (d-friends, specs/launch/v1-gameplay.md; 20261027190100_resident_friendship.sql): your first
 * talk of the day with a resident raises your friendship with them a level, up to FRIEND_MAX. Odd levels bring a
 * letter from them (here: the copy), even levels a small coin gift (the database pays it, friend_gift_coins x level / 2).
 */
export const FRIEND_MAX = 5;

/** The letter a level brings (odd levels), signed by the resident; null for a gift level. */
export function friendLetter(level: number, name: string): { subject: string; body: string } | null {
  switch (level) {
    case 1: return { subject: `A note from ${name}`, body: `Hello again! I liked our chat today. The island feels a little friendlier with you on it. Come find me tomorrow?\n\n${name}` };
    case 3: return { subject: `${name} saved you a seat`, body: `You keep stopping by, and I've started looking out for you. If you ever want company while you fish or wander, you know where to find me.\n\n${name}` };
    case 5: return { subject: `Best friends, says ${name}`, body: `Five days of chats! I think that makes us proper friends. Thank you for always saying hi. The island is better with you on it.\n\nYour friend, ${name}` };
    default: return null;
  }
}

/** What the island says when a talk raised a level. */
export function friendNote(r: { level: number; coins: number }, name: string): string {
  if (r.coins > 0) return `${name} gave you ${r.coins} coins, a little thank you for the chats. Friendship ${r.level} of ${FRIEND_MAX}.`;
  return r.level >= FRIEND_MAX ? `You and ${name} are best friends! They sent you a letter.` : `${name} sent you a letter. Friendship ${r.level} of ${FRIEND_MAX}.`;
}
