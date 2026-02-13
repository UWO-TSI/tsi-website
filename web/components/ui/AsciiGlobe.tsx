"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Earth texture as base64 (from reference)
const EARTH_TEXTURE = "data:image/jpeg;base64,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";

// ASCII character set (sparse to dense)
const ASCII_CHARS = "   ·—+=##";

interface AsciiGlobeProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function AsciiGlobe({ 
  width = 48, 
  height = 48,
  className = "",
  style = {}
}: AsciiGlobeProps) {
  const outputRef = useRef<HTMLPreElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const pixelsRef = useRef<Uint8Array | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    // Initialize Three.js
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(1, width / height, 0.1, 1000);
    camera.position.z = 345;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    rendererRef.current = renderer;

    // Load Earth texture
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(EARTH_TEXTURE);

    // Create globe
    const geometry = new THREE.SphereGeometry(3, 64, 48);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      roughness: 1,
      metalness: 1,
      map: texture
    });
    const globe = new THREE.Mesh(geometry, material);
    globe.rotation.z = Math.PI;
    globe.rotation.y = 1.5;
    scene.add(globe);
    globeRef.current = globe;

    // Add lights
    const light1 = new THREE.PointLight(0xffffff, 3.33, 0);
    light1.position.set(150, -150, 1500);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xffffff, 2, 0);
    light2.position.set(-125, 100, -500);
    scene.add(light2);

    // Initialize pixel buffer
    const gl = renderer.getContext();
    pixelsRef.current = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);

    // Render loop
    const render = () => {
      animationRef.current = requestAnimationFrame(render);
      
      if (globeRef.current) {
        globeRef.current.rotation.y -= 0.01;
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        
        const gl = rendererRef.current.getContext();
        if (gl && pixelsRef.current) {
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixelsRef.current);
          
          // Convert to ASCII
          const text = convertToAscii(pixelsRef.current, width);
          
          if (outputRef.current) {
            outputRef.current.textContent = text;
          }
        }
      }
    };

    render();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (globeRef.current) {
        globeRef.current.geometry.dispose();
        (globeRef.current.material as THREE.Material).dispose();
      }
    };
  }, [width, height]);

  // Convert pixels to grayscale and then to ASCII
  const convertToAscii = (pixels: Uint8Array, rowWidth: number): string => {
    const gsPixels: number[] = [];
    
    for (let i = 0; i < pixels.length; i += 4) {
      const grayscale = Math.floor(
        (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 768 * ASCII_CHARS.length
      );
      gsPixels.push(grayscale);
    }

    // Convert to ASCII with line breaks
    let text = gsPixels.map((val, index) => {
      const br = (index !== 0 && index % rowWidth === 0) ? "\n" : "";
      return br + ASCII_CHARS[val];
    }).join("");

    // Reverse each line (WebGL reads pixels bottom-to-top, left-to-right)
    text = text.split("\n").map(line => line.split("").reverse().join("")).join("\n");
    
    return text;
  };

  return (
    <pre
      ref={outputRef}
      className={className}
      style={{
        backgroundImage: `radial-gradient(
          circle farthest-corner at 75% 75%,
          rgba(240,240,240,1) 0%,
          rgba(220,220,220,1) 50%,
          rgba(200,200,200,1) 100%
        )`,
        borderRadius: "100%",
        color: "rgb(60, 60, 60)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "3vmin",
        lineHeight: "0.55em",
        textRendering: "optimizeSpeed",
        willChange: "contents",
        whiteSpace: "pre",
        padding: "1em",
        margin: 0,
        ...style,
      }}
    />
  );
}
