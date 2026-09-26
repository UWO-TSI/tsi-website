# audio-pass: open questions for David

Each item has the assumption taken so the work kept moving.

1. **Music fallback reuses the non-CC0 applicant tracks.** Until Suno tracks
   land, the hourly blocks fall back to Ocean Railway (day-leaning blocks)
   and Willow Tree (night-leaning blocks) — the two tracks named in the
   setup brief. `CREDITS.md` already flags these as not CC0 and their
   licence for game/site distribution as unverified. Assumption: reusing
   them as a temporary member-island music fallback carries the same
   unverified risk as their existing applicant-island use, not a new one.
   Verify before public launch, same as the existing note.
2. **"The existing settings store" for Sound = AudioManager's own
   localStorage store (`tsi.audio.v1`), not `lib/identity/settings.ts`'s
   server-backed account settings.** The latter persists to the
   `member_settings` table via discrete columns (migration
   `20260926150700_identity.sql`); adding sound fields there needs a new
   migration, which the brief said this pass shouldn't need. Assumption:
   client-only persistence (mute + 4 volumes) is acceptable for now: it
   already doesn't carry across devices for text size either until signed
   in, and audio prefs are lower-stakes than account settings. Flag if you
   want Sound synced to the account later — that's a small follow-up
   migration + `AccountSettings` field.
3. **Weather/season ambience beds have no real audio yet.** No CC0
   rain/snow/wind or seasonal loops exist in this repo or the bundled packs
   (Ninja Adventure / Kenney). `AudioManager.setAmbience` tries
   `{phase}-{weather}.ogg` then `{phase}-{season}.ogg` before the base
   `{phase}.ogg` (same cascading engine as music blocks), so once those
   files land nothing else needs to change — but today they resolve
   straight through to the unchanged 4-file base bed. Ambient audio is
   effectively unchanged from before this pass until new CC0/generated
   files are added.
4. **Combat SFX is a mapping, not new wiring.** `web/public/audio/sfx/MANIFEST.md`
   maps peaceful/crafting/combat events onto existing files and lists what
   to generate, but no combat file was edited (`web/lib/game/combat/**`,
   `web/components/game/combat/**` are untouched) per "do not edit combat."
   `game/combat-content-b` (running in parallel) or a follow-up agent should
   wire the actual `AudioManager.playSFX(...)` calls using that table.
5. **Ruins gets no dedicated music override.** The brief named "interior and
   cafe overrides" only; the ruins zone (`site === "ruins"`) keeps playing
   whatever outdoor hourly block is current rather than going silent or
   getting its own combat bed. Flag if ruins should duck the music or get
   its own track.
6. **Music block re-checks every 60s, not exactly on the 2-hour boundary.**
   Matches the existing `useIslandConditions` clock-tick cadence (also 60s)
   rather than adding precise `setTimeout`-to-boundary scheduling. The
   crossfade starts within a minute of the true boundary; imperceptible at
   a 2-hour grain, and evidence below confirms it lands in the right block.
7. **Study companion (phone) gets only the enable-on-gesture unlock, no
   volume UI.** The persisted Sound sliders live in the 3D game world's
   `SettingsSheet` only; the companion has no canvas and wasn't asked for a
   duplicate mixer.
