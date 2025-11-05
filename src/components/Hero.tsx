import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp } from "lucide-react";
import heroImage from "@/assets/hero-fashion.jpg";

export const Hero = () => {
  const scrollToUpload = () => {
    const uploadSection = document.getElementById('upload-section');
    uploadSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToTrending = () => {
    const trendingSection = document.getElementById('trending-section');
    trendingSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
      {/* Minimal Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-light/10 via-background to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full bg-secondary border border-border">
          <div className="w-2 h-2 rounded-full bg-gradient-story animate-pulse" />
          <span className="text-sm font-medium text-foreground">AI-Powered Style Analysis</span>
        </div>

        <h1 className="text-6xl md:text-8xl font-bold mb-6 tracking-tight">
          Rate Your
          <br />
          <span className="bg-gradient-primary bg-clip-text text-transparent">Style</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto font-light">
          Discover how trendy your outfit is with AI-powered analysis
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            variant="instagram" 
            size="lg"
            className="text-base rounded-full px-8"
            onClick={scrollToUpload}
          >
            <Sparkles className="h-4 w-4" />
            Rate My Outfit
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="text-base rounded-full px-8"
            onClick={scrollToTrending}
          >
            View Trends
          </Button>
        </div>

        {/* Minimalist Stats */}
        <div className="flex justify-center gap-12 mt-20">
          <div className="text-center">
            <div className="text-3xl font-bold">500K+</div>
            <div className="text-sm text-muted-foreground font-light mt-1">Outfits</div>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <div className="text-3xl font-bold">98%</div>
            <div className="text-sm text-muted-foreground font-light mt-1">Accuracy</div>
          </div>
          <div className="w-px bg-border" />
          <div className="text-center">
            <div className="text-3xl font-bold">24/7</div>
            <div className="text-sm text-muted-foreground font-light mt-1">AI Ready</div>
          </div>
        </div>
      </div>
    </section>
  );
};
