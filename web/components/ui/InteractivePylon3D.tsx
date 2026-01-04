"use client";

import { useRef, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

interface PylonPhysics {
  angle: number; // Current rotation angle in radians (around Z axis for left/right tilt)
  angularVelocity: number; // Angular velocity in radians per frame
  isToppled: boolean; // Whether the pylon has passed the tipping threshold
}

interface InteractivePylon3DProps {
  modelPath: string; // Path to GLTF/GLB model file
  gravity?: number;
  damping?: number;
  restoringTorque?: number;
  impulseStrength?: number;
  tippingThreshold?: number; // Angle in degrees at which pylon topples
  mouseInteractionRadius?: number; // Distance from pylon center for mouse interaction
  scale?: number;
  position?: [number, number, number];
}

// Internal component that handles the pylon mesh and physics
function PylonMesh({
  modelPath,
  gravity = 0.15,
  damping = 0.92,
  restoringTorque = 0.08,
  impulseStrength = 0.003,
  tippingThreshold = 45,
  mouseInteractionRadius = 150,
  scale = 1,
  position = [0, 0, 0],
}: Omit<InteractivePylon3DProps, "modelPath"> & { modelPath: string }) {
  const meshRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const physicsRef = useRef<PylonPhysics>({
    angle: 0,
    angularVelocity: 0,
    isToppled: false,
  });

  const { scene, camera, raycaster, pointer, size } = useThree();
  const mousePosRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const baseHeightRef = useRef<number>(0);

  // Load the 3D model
  const { scene: modelScene } = useGLTF(modelPath);

  // Clone the model to avoid mutating the original
  const clonedModel = modelScene.clone();

  // Calculate bounding box to find base height and position model on flat ground
  useEffect(() => {
    if (clonedModel && meshRef.current) {
      const box = new THREE.Box3().setFromObject(clonedModel);
      const size = box.getSize(new THREE.Vector3());
      baseHeightRef.current = box.min.y; // Bottom of the bounding box
      
      // Position model so its base sits on flat ground (Y=0)
      // The base should be at the origin for rotation around the base
      clonedModel.position.y = -baseHeightRef.current;
      
      // Set the mesh group's position to ensure rotation happens around the base
      // The pivot point should be at the base (Y=0)
      if (meshRef.current) {
        meshRef.current.position.set(0, 0, 0);
      }
    }
  }, [clonedModel]);

  // Convert tipping threshold to radians
  const tippingThresholdRad = (tippingThreshold * Math.PI) / 180;

  // Track mouse position
  const handleMouseMove = useCallback((event: MouseEvent) => {
    lastMousePosRef.current = { ...mousePosRef.current };
    mousePosRef.current = { x: event.clientX, y: event.clientY };

    // Update pointer for raycaster (normalized device coordinates)
    pointer.x = ((event.clientX / size.width) * 2 - 1);
    pointer.y = -((event.clientY / size.height) * 2 + 1);
  }, [pointer, size]);

  // Mouse tracking
  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [handleMouseMove]);

  // Physics and animation loop
  useFrame((state, delta) => {
    if (!meshRef.current || !pivotRef.current) return;

    const physics = physicsRef.current;
    const deltaTime = Math.min(delta * 60, 2); // Normalize to 60fps, cap at 2x

    // Get pylon world position
    const pylonWorldPos = new THREE.Vector3();
    pivotRef.current.getWorldPosition(pylonWorldPos);

    // Project pylon position to screen space
    const screenPos = pylonWorldPos.clone().project(camera);
    const screenX = (screenPos.x + 1) * size.width / 2;
    const screenY = (-screenPos.y + 1) * size.height / 2;

    // Calculate distance from mouse to pylon in screen space
    const dx = mousePosRef.current.x - screenX;
    const dy = mousePosRef.current.y - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Apply mouse impulse if mouse is near pylon
    if (distance < mouseInteractionRadius && !physics.isToppled) {
      // Calculate mouse velocity
      const mouseDx = mousePosRef.current.x - lastMousePosRef.current.x;
      const mouseDy = mousePosRef.current.y - lastMousePosRef.current.y;
      const mouseSpeed = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

      // Apply horizontal impulse proportional to mouse velocity
      // The impulse direction depends on which side of the pylon the mouse is on
      if (distance > 0) {
        const horizontalImpulse = (dx / distance) * mouseSpeed * impulseStrength * deltaTime;
        physics.angularVelocity += horizontalImpulse;
      }
    }

    // Apply gravity (pulls pylon toward flat ground when tilted)
    // For a pylon tilting around Z axis, gravity creates torque proportional to sin(angle)
    // This pulls the pylon back toward vertical (flat ground)
    const gravityTorque = Math.sin(physics.angle) * gravity * deltaTime;
    physics.angularVelocity += gravityTorque;

    // Apply restoring torque if not toppled (tries to return upright)
    if (!physics.isToppled) {
      const restoringForce = -physics.angle * restoringTorque * deltaTime;
      physics.angularVelocity += restoringForce;
    }

    // Apply damping to reduce oscillation
    physics.angularVelocity *= Math.pow(damping, deltaTime);

    // Update angle
    physics.angle += physics.angularVelocity * deltaTime;

    // Check if pylon has passed tipping threshold
    if (!physics.isToppled && Math.abs(physics.angle) > tippingThresholdRad) {
      physics.isToppled = true;
    }

    // If toppled, apply stronger gravity and additional damping
    if (physics.isToppled) {
      // Stronger gravity effect when toppled - pulls toward flat ground
      const toppledGravity = Math.sin(physics.angle) * gravity * 1.5 * deltaTime;
      physics.angularVelocity += toppledGravity;
      
      // Additional damping when toppled to help it settle on flat ground
      physics.angularVelocity *= 0.98;
    }

    // Apply rotation around Z axis (horizontal axis through base for left/right tilt)
    // Rotation happens around the base pivot point on flat ground
    // Gravity pulls straight down (toward Y=0), creating torque based on tilt angle
    if (pivotRef.current) {
      pivotRef.current.rotation.z = physics.angle;
    }
  });

  return (
    <group 
      ref={pivotRef} 
      position={[position[0], position[1], position[2]]}
      // Rotation pivot is at the base (Y position), so pylon rotates around flat ground
    >
      <group 
        ref={meshRef} 
        scale={scale}
        // Mesh is positioned so base is at pivot point for flat ground rotation
      >
        <primitive object={clonedModel} />
      </group>
    </group>
  );
}

export default function InteractivePylon3D({
  modelPath,
  gravity = 0.15,
  damping = 0.92,
  restoringTorque = 0.08,
  impulseStrength = 0.003,
  tippingThreshold = 45,
  mouseInteractionRadius = 150,
  scale = 1,
  position = [0, 0, 0],
}: InteractivePylon3DProps) {
  return (
    <Canvas
      orthographic
      camera={{ 
        position: [10, 1, 0], // Side view camera - looking along X axis
        zoom: 80, // Increased zoom to fill screen better
        near: 0.1,
        far: 100
      }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      gl={{ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
        depth: true
      }}
    >
      {/* Lighting - adjusted for 2D side view */}
      <ambientLight intensity={0.7} />
      <directionalLight position={[0, 5, 0]} intensity={0.9} />

      {/* Simple 2D ground line - appears as horizontal line in side view, wider to fill screen */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[20, 0.2]} />
        <meshStandardMaterial 
          color="#333333" 
        />
      </mesh>

      {/* Pylon with physics */}
      <PylonMesh
        modelPath={modelPath}
        gravity={gravity}
        damping={damping}
        restoringTorque={restoringTorque}
        impulseStrength={impulseStrength}
        tippingThreshold={tippingThreshold}
        mouseInteractionRadius={mouseInteractionRadius}
        scale={scale}
        position={position}
      />
    </Canvas>
  );
}

