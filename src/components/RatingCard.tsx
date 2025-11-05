import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Palette, Sparkles, Star } from "lucide-react";

const ratingFactors = [
  {
    icon: TrendingUp,
    name: "Trend Alignment",
    score: 92,
    description: "Your outfit matches current fashion trends",
  },
  {
    icon: Palette,
    name: "Color Harmony",
    score: 88,
    description: "Excellent color coordination",
  },
  {
    icon: Sparkles,
    name: "Style Originality",
    score: 95,
    description: "Unique and creative combination",
  },
  {
    icon: Star,
    name: "Overall Appeal",
    score: 90,
    description: "Strong visual impact",
  },
];

export const RatingCard = () => {
  const overallScore = Math.round(
    ratingFactors.reduce((acc, factor) => acc + factor.score, 0) / ratingFactors.length
  );

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-gradient-primary text-primary-foreground px-4 py-2">
            Analysis Results
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Your Outfit Score
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Overall Score */}
          <Card className="p-8 bg-gradient-card shadow-glow border-2 border-primary/20">
            <div className="text-center">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
                <div className="relative text-7xl md:text-8xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  {overallScore}
                </div>
              </div>
              <p className="text-xl font-semibold mb-2">Outstanding!</p>
              <p className="text-muted-foreground">
                Your outfit is trending in the top 10%
              </p>
            </div>
          </Card>

          {/* Detailed Factors */}
          <div className="space-y-4">
            {ratingFactors.map((factor, index) => {
              const Icon = factor.icon;
              return (
                <Card
                  key={index}
                  className="p-6 bg-gradient-card shadow-card hover:shadow-glow transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-gradient-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{factor.name}</h3>
                        <span className="text-lg font-bold text-primary">
                          {factor.score}%
                        </span>
                      </div>
                      <Progress value={factor.score} className="mb-2 h-2" />
                      <p className="text-sm text-muted-foreground">
                        {factor.description}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
