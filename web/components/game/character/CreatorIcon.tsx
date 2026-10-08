/**
 * The creator rail's own icons for the parts that have no item icon (the head, hair and face): pen-drawn line
 * pictures in the GUI sheet's ink, a little uneven like the kit's hand lettering. Clothes and accessories use their
 * real item icons (public/assets/icons) instead.
 */
import type { IconKey } from "@/lib/game/character/creatorCategories";

const PATHS: Record<Exclude<IconKey, "part">, React.ReactNode> = {
  head: <>
    <path d="M8.6 20.6c-.2-1.9-.9-3-2.2-4.2-1.3-1.3-2.1-3.3-2.1-5.6 0-4.6 3.4-8 7.9-8 4.4 0 7.6 3.1 7.6 7.4 0 1.2-.2 2.2-.6 3.1l1.4 2.4c.2.4 0 .8-.4.9l-1.1.3.1 1.6c0 .9-.7 1.6-1.6 1.6h-1.6l-.1 1.2" />
    <path d="M10.9 12.2c.4-.6 1.2-.6 1.6 0" /><path d="M10.4 9.4c.6-.3 1.3-.3 1.9 0" />
  </>,
  hair: <>
    <path d="M6.2 19.8c-1.6-2-2.4-4.7-2.2-7.6.3-4.9 3.7-8.4 8.1-8.4 4.5 0 7.9 3.4 8 8.3.1 2.9-.7 5.6-2.3 7.7" />
    <path d="M7.4 11.2c1.9-.3 4.2-1.6 5.4-3.9.9 2.1 2.6 3.5 4.6 4" /><path d="M7.4 11.2c-.3 2.6.1 5.4 1.3 7.6" /><path d="M17.4 11.3c.3 2.6-.1 5.3-1.2 7.5" />
  </>,
  eyes: <>
    <path d="M2.4 12.2c1.2-2 2.6-3 4.2-3s3 1 4.2 3c-1.2 1.9-2.6 2.9-4.2 2.9s-3-1-4.2-2.9Z" />
    <path d="M13.2 12c1.2-2 2.6-3 4.2-3s3 1 4.2 3c-1.2 1.9-2.6 2.9-4.2 2.9s-3-1-4.2-2.9Z" />
    <circle cx="6.6" cy="12.1" r="1.4" fill="currentColor" stroke="none" /><circle cx="17.4" cy="11.9" r="1.4" fill="currentColor" stroke="none" />
  </>,
  brows: <>
    <path d="M2.8 13.4c1.4-2.3 3.6-3.4 6.4-3.1.7.1 1.3.3 1.8.6" /><path d="M21.2 13.4c-1.4-2.3-3.6-3.4-6.4-3.1-.7.1-1.3.3-1.8.6" />
    <path d="M4.4 15.6c1.2-1.3 2.9-1.9 4.9-1.6" opacity=".55" /><path d="M19.6 15.6c-1.2-1.3-2.9-1.9-4.9-1.6" opacity=".55" />
  </>,
  mouth: <>
    <path d="M3.2 11.6c1.7-1.8 3.4-2.6 5.2-2.4.9.1 1.8.6 2.6 1.3.8-.7 1.7-1.2 2.7-1.3 1.8-.2 3.6.6 5.2 2.4" />
    <path d="M3.2 11.6c2.1 3.4 4.9 5 8.6 5s6.6-1.6 8.9-5" /><path d="M3.4 11.7c3 .9 5.9 1.3 8.6 1.2 2.7-.1 5.6-.5 8.6-1.3" />
  </>,
  extras: <>
    <path d="M12 3.6c4.7 0 8.3 3.6 8.3 8.4 0 4.7-3.6 8.4-8.3 8.4S3.7 16.7 3.7 12c0-4.8 3.6-8.4 8.3-8.4Z" />
    <ellipse cx="7.8" cy="14.2" rx="2" ry="1.1" fill="currentColor" stroke="none" opacity=".45" /><ellipse cx="16.2" cy="14.2" rx="2" ry="1.1" fill="currentColor" stroke="none" opacity=".45" />
    <path d="M9 10.6v.3" /><path d="M15 10.6v.3" /><path d="M10.3 15.9c1 .8 2.4.8 3.4 0" />
  </>,
};

/** A line icon (`part`: a hanger, for a catalogue slot without an item icon). */
export default function CreatorIcon({ icon, size = 32 }: { icon: IconKey; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icon === "part" ? <><path d="M12 7.2a1.9 1.9 0 1 1 1.9-1.9c0 1-.8 1.4-1.9 2.2v1.1" /><path d="M12 8.6 3.4 15.1c-.8.6-.4 1.8.6 1.8h16c1 0 1.4-1.2.6-1.8L12 8.6Z" /></> : PATHS[icon]}
  </svg>;
}
