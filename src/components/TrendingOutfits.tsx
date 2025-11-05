import { Card } from "@/components/ui/card";
import { Heart } from "lucide-react";

const trendingOutfits = [
  {
    title: "Minimalist",
    score: 96,
    likes: "2.4K",
  },
  {
    title: "Street Style",
    score: 94,
    likes: "1.8K",
  },
  {
    title: "Business",
    score: 92,
    likes: "3.1K",
  },
  {
    title: "Vintage",
    score: 90,
    likes: "2.9K",
  },
  {
    title: "Casual",
    score: 88,
    likes: "2.2K",
  },
  {
    title: "Athleisure",
    score: 87,
    likes: "1.9K",
  },
];

export const TrendingOutfits = () => {
  return (
    <section id="trending-section" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-primary-light/20 border border-primary/10">
            <div className="w-1.5 h-1.5 rounded-full bg-gradient-story animate-pulse" />
            <span className="text-sm font-medium text-primary">Trending</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Popular Styles
          </h2>
          <p className="text-lg text-muted-foreground font-light">
            What's hot right now
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {trendingOutfits.map((outfit, index) => (
            <Card
              key={index}
              className="p-0 bg-background shadow-soft border border-border rounded-2xl hover:shadow-medium transition-all duration-200 hover:-translate-y-1 cursor-pointer overflow-hidden group"
            >
              {/* Image placeholder with gradient */}
              <div className="aspect-square bg-gradient-story opacity-20 group-hover:opacity-30 transition-opacity" />
              
              <div className="p-4">
                <h3 className="font-semibold text-sm mb-2">{outfit.title}</h3>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Heart className="h-3 w-3" />
                    <span className="font-light">{outfit.likes}</span>
                  </div>
                  <div className="text-lg font-bold">{outfit.score}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
