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
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Fashion boutique showcasing trendy outfits"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/80" />
      </div>

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-hero z-0" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-muted/50 backdrop-blur-sm border border-border">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI-Powered Outfit Analysis</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
          Discover Your Style Score
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
          Trendify scans the internet for the hottest fashion trends and rates your outfit based on style, color coordination, and current fashion popularity.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            variant="hero" 
            size="lg"
            className="text-lg px-8 py-6 h-auto"
            onClick={scrollToUpload}
          >
            <Sparkles className="h-5 w-5" />
            Rate My Outfit
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="text-lg px-8 py-6 h-auto backdrop-blur-sm"
            onClick={scrollToTrending}
          >
            View Trending Styles
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl mx-auto">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">500K+</div>
            <div className="text-sm text-muted-foreground mt-2">Outfits Analyzed</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">98%</div>
            <div className="text-sm text-muted-foreground mt-2">Accuracy Rate</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">24/7</div>
            <div className="text-sm text-muted-foreground mt-2">AI Analysis</div>
          </div>
        </div>
      </div>
    </section>
  );
};
