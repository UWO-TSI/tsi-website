# Hourly music blocks

Audio pass (ledger rows 84, 106, 112-114). The member island's music channel
follows the real Toronto clock in twelve 2-hour blocks. `AudioManager`
(`web/lib/game/audio.ts`, schedule in `web/lib/game/musicSchedule.ts`) loads
`{block}.mp3` from this folder when present, crossfading at the block
boundary (~800ms fade, same engine as the day/night ambient bed). Until a
file lands, that block silently falls back to one of the two existing
applicant-island tracks (Ocean Railway for daytime blocks, Willow Tree for
evening/night — see `web/public/audio/CREDITS.md`; **their licence for this
reuse hasn't been verified**, flagged in `specs/audio-pass-questions.md`).

## The 12 expected files

Real-Toronto-time block, file name, and expected mood (ACNH-style acoustic:
guitar, marimba, soft piano, light percussion — decision 112):

| Block | File | Time | Mood |
|---|---|---|---|
| 00-02 | `00.mp3` | Late night | Sparse, sleepy |
| 02-04 | `02.mp3` | Deep night | Sparse, sleepy |
| 04-06 | `04.mp3` | Pre-dawn | Slow, hushed |
| 06-08 | `06.mp3` | Dawn | Gentle, waking up |
| 08-10 | `08.mp3` | Morning | Bright, easy tempo |
| 10-12 | `10.mp3` | Late morning | Bright, busier |
| 12-14 | `12.mp3` | Midday | Warm, full band |
| 14-16 | `14.mp3` | Afternoon | Warm, full band |
| 16-18 | `16.mp3` | Late afternoon | Mellowing |
| 18-20 | `18.mp3` | Evening | Cozy, slower |
| 20-22 | `20.mp3` | Night | Quiet, reflective |
| 22-24 | `22.mp3` | Late night | Sparse, sleepy |

Source: Suno AI (decision 114 — Suno is the source, not Higgsfield/ElevenLabs;
check Suno's licence tier for commercial/club use before shipping, and keep
the generated originals plus prompts in the asset ledger). Normalise and
loop-trim locally after export.

## Optional override slots (also this folder)

- `cafe.mp3` — plays instead of the hourly block while the player is inside
  the cafe (any time of day).
- `interior.mp3` — plays instead of the hourly block inside any other
  building (HQ, house, museum, Oracle temple).
- `{block}-{season}.mp3` (e.g. `12-winter.mp3`) — a seasonal variant slot for
  a given block (decision 113: "seasonal variants later"). Tried before the
  plain block file when present; nothing needs to change in code when these
  land.

## Loudness target

Music: **-18 to -20 LUFS integrated**, true peak **≤ -3 dBFS**, matching the
existing CC0 ambient loops so the crossfade between hourly blocks and the
ambient bed doesn't jump in perceived loudness. Export as MP3 (this player
loads `.mp3`, unlike the OGG ambient/SFX set).
