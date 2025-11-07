import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, TrendingUp, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Analyzer() {
  const [imageUrl, setImageUrl] = useState("");
  const [targetStyle, setTargetStyle] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageUrl || !targetStyle) {
      toast({
        title: "Missing Information",
        description: "Please provide both an image URL and target style",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-outfit', {
        body: { imageUrl, targetStyle }
      });

      if (error) throw error;

      setResult(data);
      
      toast({
        title: "Analysis Complete!",
        description: "Your outfit has been analyzed against current trends",
      });
    } catch (error) {
      console.error("Error analyzing outfit:", error);
      toast({
        title: "Analysis Failed",
        description: "Failed to analyze outfit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 pb-24 md:pb-6">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-bold">Outfit Analyzer</h1>
        </div>
        <p className="text-muted-foreground">
          See how your outfit matches current fashion trends
        </p>
      </div>

      <Card className="p-6 mb-6 border-border">
        <form onSubmit={handleAnalyze} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="imageUrl">Outfit Image URL</Label>
            <Input
              id="imageUrl"
              type="url"
              placeholder="https://example.com/outfit.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              required
            />
          </div>

          {imageUrl && (
            <div className="aspect-square max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
              <img
                src={imageUrl}
                alt="Outfit preview"
                className="w-full h-full object-cover"
                onError={() => {
                  toast({
                    title: "Invalid image",
                    description: "Please check your image URL",
                    variant: "destructive",
                  });
                }}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="targetStyle">Target Style</Label>
            <Input
              id="targetStyle"
              placeholder="e.g., Y2K, Streetwear, Minimalist, Cottagecore"
              value={targetStyle}
              onChange={(e) => setTargetStyle(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              What style aesthetic are you going for?
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={analyzing} size="lg">
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Analyze Outfit
              </>
            )}
          </Button>
        </form>
      </Card>

      {result && (
        <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Analysis Results
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-4 border-border text-center">
              <div className="text-3xl font-bold text-primary mb-1">
                {result.rating || 0}/10
              </div>
              <div className="text-sm text-muted-foreground">Style Rating</div>
            </Card>
            
            <Card className="p-4 border-border text-center">
              <div className="text-3xl font-bold text-secondary mb-1">
                {result.trendMatch || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Trend Match</div>
            </Card>
          </div>

          {result.feedback && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">AI Feedback</h3>
              <p className="text-sm leading-relaxed">{result.feedback}</p>
            </div>
          )}

          {result.matchingTrends && result.matchingTrends.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Matching Trends
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.matchingTrends.map((trend: string, index: number) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    #{trend}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
