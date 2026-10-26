/**
 * The shipwright's boat (wharf-art4's, propModels.ts), afloat beside its shed where the shed's gangplank meets its
 * gunwale, rocking gently on the water (David, R2d: "half buildign half ship floating on the water ... it wobbles with
 * the wave"): a slow roll, pitch and heave about the plank's end, so the plank stays on the gunwale and the bow moves
 * most. One transform a frame.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";
import { applyModelTextures, disposeModelMaterials, prepareModel } from "@/lib/game/modelMaterials";
import type { NaturePlacement } from "../InstancedNature";

const URL = "/assets/game/wharf/shipwright-boat.glb";
/** Where it floats in the shed's frame, and the plank's end in its own (its pivot). */
const AT = [5.4, -1.078, -3.6] as const, PIVOT_Z = 1.6;

export default function ShipwrightBoat({ shed }: { shed: NaturePlacement }) {
  const { scene } = useGLTF(URL);
  const model = useMemo(() => prepareModel(scene, URL), [scene]);
  useEffect(() => {
    applyModelTextures(model, URL);
    return () => disposeModelMaterials(model);
  }, [model]);
  const pivot = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const p = pivot.current, t = clock.elapsedTime;
    if (!p) return;
    p.rotation.z = 0.03 * Math.sin(t * 0.9) + 0.012 * Math.sin(t * 1.7 + 1);
    p.rotation.x = 0.012 * Math.sin(t * 0.7 + 2);
    p.position.y = 0.02 * Math.sin(t * 1.1);
  });
  const [x, y, z] = shed.position, r = shed.rotation ?? 0, c = Math.cos(r), s = Math.sin(r);
  return (
    <group position={[x + AT[0] * c + AT[2] * s, y + AT[1], z - AT[0] * s + AT[2] * c]} rotation={[0, r, 0]}>
      <group ref={pivot} position={[0, 0, PIVOT_Z]}>
        <primitive object={model} position={[0, 0, -PIVOT_Z]} />
      </group>
    </group>
  );
}
