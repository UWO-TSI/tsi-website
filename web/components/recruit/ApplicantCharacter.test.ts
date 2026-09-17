import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createApplicantAnimation } from "./ApplicantCharacter";

describe("applicant animation lifecycle", () => {
  it("uses an independent slower movement action when a model only supplies Run", () => {
    const model = new THREE.Group();
    const bone = new THREE.Bone(); bone.name = "Hip"; model.add(bone);
    const clips = ["Idle", "Run"].map(name => new THREE.AnimationClip(name, 1, [
      new THREE.NumberKeyframeTrack("Hip.position[x]", [0, 0.5, 1], [0, 1, 0]),
    ]));
    const session = createApplicantAnimation(model, clips);
    expect(session.actions.Walk).not.toBe(session.actions.Run);
    expect(session.walkTempo).toBe(0.65);
    expect(clips.map(clip => clip.name)).toEqual(["Idle", "Run"]);
    session.actions.Walk.play();
    session.actions.Idle.crossFadeTo(session.actions.Walk, 0.16, false);
    expect(() => session.mixer.update(0.25)).not.toThrow();
    session.dispose();
  });
  it("recreates valid Three bindings when Strict Mode replays setup after cleanup", () => {
    const model = new THREE.Group();
    const bone = new THREE.Bone(); bone.name = "Hip"; model.add(bone);
    const clips = ["Idle", "Walk", "Run"].map((name, index) => new THREE.AnimationClip(name, 1, [
      new THREE.NumberKeyframeTrack("Hip.position[x]", [0, 0.5, 1], [0, index + 1, 0]),
    ]));
    const first = createApplicantAnimation(model, clips);
    first.mixer.update(0.25);
    expect(bone.position.x).toBeCloseTo(0.5);
    first.dispose();
    expect(bone.position.x).toBe(0);

    const replay = createApplicantAnimation(model, clips);
    expect(replay.actions.Idle).not.toBe(first.actions.Idle);
    replay.mixer.update(0.25);
    expect(bone.position.x).toBeCloseTo(0.5);
    replay.actions.Walk.reset().play();
    replay.actions.Idle.crossFadeTo(replay.actions.Walk, 0.16, false);
    expect(() => replay.mixer.update(0.25)).not.toThrow();
    replay.actions.Run.reset().play();
    replay.actions.Walk.crossFadeTo(replay.actions.Run, 0.16, false);
    expect(() => replay.mixer.update(0.25)).not.toThrow();
    replay.dispose();
    const remount = createApplicantAnimation(model, clips);
    expect(() => remount.mixer.update(0.25)).not.toThrow();
    remount.dispose();
  });
});
