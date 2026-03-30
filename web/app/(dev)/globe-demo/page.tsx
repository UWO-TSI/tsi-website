import GlobeVisualizer from "@/components/ui/GlobeVisualizer";
import CustomCursor from "@/components/ui/CustomCursor";

export default function GlobeDemoPage() {
  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0f0f10",
      }}
    >
      <CustomCursor />
      <GlobeVisualizer />
    </main>
  );
}
