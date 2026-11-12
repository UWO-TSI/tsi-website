import "./home.css";
import HeroDive from "@/components/site/home/HeroDive";
import Numbers from "@/components/site/home/Numbers";
import WhoAreYou from "@/components/site/home/WhoAreYou";
import Dates from "@/components/site/home/Dates";
import GenesisHome from "@/components/site/home/GenesisHome";
import Team from "@/components/site/home/Team";
import Closing from "@/components/site/home/Closing";
import GlyphSeam from "@/components/site/GlyphSeam";
import DotNav from "@/components/site/DotNav";

const SECTIONS = [
  { id: "hero", label: "Tethos" },
  { id: "numbers", label: "In numbers" },
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
      <Numbers />
      <GlyphSeam from="light" to="dark" seed={1} />
      {/* Dark from here to the one white section at the end, the call to join. */}
      <WhoAreYou />
      <Dates />
      <GenesisHome />
      <Team />
      <GlyphSeam from="dark" to="light" seed={5} />
      <Closing />
    </>
  );
}
