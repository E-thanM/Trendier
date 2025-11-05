import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Palette, Sparkles, Star } from "lucide-react";

const ratingFactors = [
  {
    icon: TrendingUp,
    name: "Trend Score",
    score: 92,
    description: "Matches current trends",
  },
  {
    icon: Palette,
    name: "Color Match",
    score: 88,
    description: "Great color harmony",
  },
  {
    icon: Sparkles,
    name: "Originality",
    score: 95,
    description: "Unique style mix",
  },
  {
    icon: Star,
    name: "Overall",
    score: 90,
    description: "Strong visual appeal",
  },
];

export const RatingCard = () => {
  const overallScore = Math.round(
    ratingFactors.reduce((acc, factor) => acc + factor.score, 0) / ratingFactors.length
  );

  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full bg-primary-light/20 border border-primary/10">
            <span className="text-sm font-medium text-primary">Results</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Your Style Score
          </h2>
        </div>

        <div className="grid md:grid-cols-5 gap-6 items-start">
          {/* Overall Score - Instagram story style */}
          <div className="md:col-span-2">
            <Card className="p-8 bg-background shadow-soft border border-border rounded-3xl text-center">
              <div className="w-40 h-40 mx-auto mb-6 rounded-full bg-gradient-story p-[3px]">
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  <div className="text-6xl font-bold">
                    {overallScore}
                  </div>
                </div>
              </div>
              <p className="text-lg font-semibold mb-1">Outstanding</p>
              <p className="text-sm text-muted-foreground font-light">
                Top 10% trending
              </p>
            </Card>
          </div>

          {/* Detailed Factors */}
          <div className="md:col-span-3 space-y-3">
            {ratingFactors.map((factor, index) => {
              const Icon = factor.icon;
              return (
                <Card
                  key={index}
                  className="p-5 bg-background shadow-soft border border-border rounded-2xl hover:shadow-medium transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary-light/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm">{factor.name}</h3>
                        <span className="text-base font-bold">
                          {factor.score}
                        </span>
                      </div>
                      <Progress value={factor.score} className="mb-1.5 h-1.5" />
                      <p className="text-xs text-muted-foreground font-light">
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
