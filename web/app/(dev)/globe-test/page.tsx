"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const AsciiGlobe = dynamic(() => import("@/components/ui/AsciiGlobe"), {
  ssr: false,
  loading: () => (
    <div className="w-[300px] h-[300px] flex items-center justify-center text-gray-500">
      Loading Three.js...
    </div>
  ),
});

export default function GlobeTestPage() {
  const [width, setWidth] = useState(48);
  const [height, setHeight] = useState(48);
  const [fontSize, setFontSize] = useState(3);
  const [lineHeight, setLineHeight] = useState(0.55);
  const [showControls, setShowControls] = useState(true);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{
        backgroundImage: "radial-gradient(circle, #000 25vmin, #024 100vmax)",
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      {/* Title */}
      <h1 className="text-white text-2xl mb-8 tracking-wider">
        ASCII Globe Test Environment
      </h1>

      {/* Globe Container */}
      <div className="relative">
        <AsciiGlobe
          width={width}
          height={height}
          style={{
            fontSize: `${fontSize}vmin`,
            lineHeight: `${lineHeight}em`,
          }}
        />
      </div>

      {/* Toggle Controls Button */}
      <button
        onClick={() => setShowControls(!showControls)}
        className="mt-8 px-4 py-2 bg-gray-800 text-white text-sm border border-gray-600 hover:bg-gray-700 transition-colors"
      >
        {showControls ? "Hide Controls" : "Show Controls"}
      </button>

      {/* Controls Panel */}
      {showControls && (
        <div className="mt-6 p-6 bg-gray-900/80 border border-gray-700 rounded-lg max-w-md w-full">
          <h2 className="text-white text-lg mb-4">Settings</h2>

          {/* Resolution */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-2">
              Resolution: {width}x{height}
            </label>
            <input
              type="range"
              min="24"
              max="96"
              value={width}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setWidth(val);
                setHeight(val);
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>24 (fast)</span>
              <span>96 (detailed)</span>
            </div>
          </div>

          {/* Font Size */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-2">
              Font Size: {fontSize}vmin
            </label>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={fontSize}
              onChange={(e) => setFontSize(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Line Height */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-2">
              Line Height: {lineHeight}em
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={lineHeight}
              onChange={(e) => setLineHeight(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              ~0.55em makes it circular
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="mt-6">
            <label className="text-gray-400 text-sm block mb-2">Presets</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  setWidth(48);
                  setHeight(48);
                  setFontSize(3);
                  setLineHeight(0.55);
                }}
                className="px-3 py-1 bg-green-800 text-white text-xs border border-green-600 hover:bg-green-700"
              >
                Default
              </button>
              <button
                onClick={() => {
                  setWidth(64);
                  setHeight(64);
                  setFontSize(2);
                  setLineHeight(0.55);
                }}
                className="px-3 py-1 bg-blue-800 text-white text-xs border border-blue-600 hover:bg-blue-700"
              >
                High Detail
              </button>
              <button
                onClick={() => {
                  setWidth(32);
                  setHeight(32);
                  setFontSize(4);
                  setLineHeight(0.55);
                }}
                className="px-3 py-1 bg-purple-800 text-white text-xs border border-purple-600 hover:bg-purple-700"
              >
                Large
              </button>
              <button
                onClick={() => {
                  setWidth(48);
                  setHeight(48);
                  setFontSize(2);
                  setLineHeight(0.55);
                }}
                className="px-3 py-1 bg-orange-800 text-white text-xs border border-orange-600 hover:bg-orange-700"
              >
                Small
              </button>
            </div>
          </div>

          {/* Current CSS Values */}
          <div className="mt-6 p-3 bg-black/50 rounded text-xs">
            <p className="text-gray-400 mb-2">Current CSS:</p>
            <code className="text-green-400">
              {`font-size: ${fontSize}vmin;`}
              <br />
              {`line-height: ${lineHeight}em;`}
              <br />
              {`canvas: ${width}x${height}px`}
            </code>
          </div>
        </div>
      )}

      {/* Info */}
      <p className="mt-8 text-gray-500 text-xs text-center max-w-md">
        The globe uses Three.js to render a 3D Earth to a hidden canvas,
        then converts the pixels to ASCII characters in real-time.
      </p>
    </div>
  );
}
