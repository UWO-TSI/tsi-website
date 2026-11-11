import "./home.css";
import HeroDive from "@/components/site/home/HeroDive";
import WhoAreYou from "@/components/site/home/WhoAreYou";
import Dates from "@/components/site/home/Dates";
import GenesisHome from "@/components/site/home/GenesisHome";
import Team from "@/components/site/home/Team";
import Closing from "@/components/site/home/Closing";
import GlyphSeam from "@/components/site/GlyphSeam";
import DotNav from "@/components/site/DotNav";

const SECTIONS = [
  { id: "hero", label: "Tethos" },
  { id: "audiences", label: "Who are you" },
  { id: "dates", label: "The year" },
  { id: "genesis", label: "GENESIS" },
  { id: "team", label: "The people" },
  { id: "join", label: "Join" },
];

export default function HomePage() {
  return (
    <>
      <DotNav sections={SECTIONS} />
      <HeroDive />
      <GlyphSeam from="light" to="dark" seed={1} />
      <WhoAreYou />
      <GlyphSeam from="dark" to="light" seed={2} />
      <Dates />
      <GlyphSeam from="light" to="deep" seed={3} />
      <GenesisHome />
      <GlyphSeam from="deep" to="light" seed={4} />
      <Team />
      <GlyphSeam from="light" to="dark" seed={5} />
      {/* The closing disc ends fully open on the light ground, so it meets the light footer without a seam. */}
      <Closing />
    </>
  );
}
