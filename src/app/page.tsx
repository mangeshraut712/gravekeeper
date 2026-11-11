import FogOverlay from "@/components/FogOverlay";
import Gravekeeper from "@/components/Gravekeeper";

export default function Home() {
  return (
    <>
      <FogOverlay />
      <div className="relative z-10">
        <Gravekeeper />
      </div>
    </>
  );
}
