import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Heart } from "lucide-react";

const trendingOutfits = [
  {
    title: "Minimalist Chic",
    score: 96,
    trend: "Hot",
    likes: "2.4K",
  },
  {
    title: "Street Style",
    score: 94,
    trend: "Rising",
    likes: "1.8K",
  },
  {
    title: "Business Casual",
    score: 92,
    trend: "Steady",
    likes: "3.1K",
  },
  {
    title: "Vintage Revival",
    score: 90,
    trend: "Hot",
    likes: "2.9K",
  },
];

export const TrendingOutfits = () => {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-gradient-primary/10 backdrop-blur-sm border border-primary/20">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">What's Trending Now</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Top Rated Styles
          </h2>
          <p className="text-xl text-muted-foreground">
            Discover what's popular in fashion right now
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trendingOutfits.map((outfit, index) => (
            <Card
              key={index}
              className="p-6 bg-gradient-card shadow-card hover:shadow-glow transition-all duration-300 hover:-translate-y-2 cursor-pointer group"
            >
              <div className="aspect-square rounded-lg bg-gradient-hero mb-4 flex items-center justify-center">
                <div className="text-6xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {outfit.score}
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">{outfit.title}</h3>
                  <Badge 
                    variant="secondary"
                    className="bg-gradient-primary text-primary-foreground"
                  >
                    {outfit.trend}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  <span className="text-sm">{outfit.likes} likes</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
