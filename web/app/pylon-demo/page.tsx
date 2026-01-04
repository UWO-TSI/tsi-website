"use client";

import InteractivePylon3D from "@/components/ui/InteractivePylon3D";

export default function PylonDemoPage() {
  return (
    <div className="min-h-screen bg-[#0F0F10] flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Interactive 3D Pylon Demo
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Move your mouse near the pylon to apply force. It will tilt, wobble, 
            and topple based on physics simulation. Once past the tipping threshold, 
            it will fully topple and settle naturally.
          </p>
        </div>

        <div className="w-full h-[600px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
          <InteractivePylon3D
            modelPath="/models/pylon.glb" // Place your GLTF/GLB file in /public/models/
            gravity={0.15}
            damping={0.92}
            restoringTorque={0.08}
            impulseStrength={0.003}
            tippingThreshold={45}
            mouseInteractionRadius={150}
            scale={1}
            position={[0, 0, 0]}
          />
        </div>

        <div className="mt-8 text-center text-sm text-zinc-500 max-w-xl mx-auto">
          <p className="mb-4">
            <strong>Instructions:</strong> Move your mouse quickly near the pylon to knock it over. 
            The physics system uses gravity, damping, and restoring torque to create natural motion.
          </p>
          <p>
            <strong>Note:</strong> Place your Blender model (GLTF/GLB format) in 
            <code className="bg-zinc-800 px-2 py-1 rounded mx-1">/web/public/models/</code> 
            and update the filename in the <code className="bg-zinc-800 px-2 py-1 rounded mx-1">modelPath</code> prop above.
          </p>
        </div>
      </div>
    </div>
  );
}

