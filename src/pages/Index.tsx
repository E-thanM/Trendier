import { Hero } from "@/components/Hero";
import { OutfitUpload } from "@/components/OutfitUpload";
import { RatingCard } from "@/components/RatingCard";
import { TrendingOutfits } from "@/components/TrendingOutfits";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <OutfitUpload />
      <RatingCard />
      <TrendingOutfits />
    </div>
  );
};

export default Index;
