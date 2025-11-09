import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, TrendingUp, Star, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { TrendDetailModal } from "@/components/TrendDetailModal";

const targetStyleSchema = z.object({
  targetStyle: z.string().trim().min(1, "Target style is required").max(100, "Target style must be less than 100 characters")
});

export default function Analyzer() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [targetStyle, setTargetStyle] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedTrend, setSelectedTrend] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('outfits')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('outfits')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageFile || !targetStyle) {
      toast({
        title: "Missing Information",
        description: "Please select an image and enter target style",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      // Validate target style
      const validation = targetStyleSchema.safeParse({ targetStyle });
      if (!validation.success) {
        toast({
          title: "Invalid Target Style",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setAnalyzing(false);
        return;
      }

      // Upload image to storage
      const imageUrl = await uploadImageToStorage(imageFile);

      // Get current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke('analyze-outfit', {
        body: { imageUrl, targetStyle: validation.data.targetStyle },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
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

  const handleTrendClick = async (trendName: string) => {
    try {
      const { data, error } = await supabase
        .from('trends')
        .select('*')
        .ilike('name', `%${trendName}%`)
        .single();

      if (error || !data) {
        toast({
          title: "Trend Not Found",
          description: "Could not find detailed information for this trend",
          variant: "destructive",
        });
        return;
      }

      setSelectedTrend(data);
      setModalOpen(true);
    } catch (error) {
      console.error("Error fetching trend:", error);
      toast({
        title: "Error",
        description: "Failed to load trend details",
        variant: "destructive",
      });
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
            <Label htmlFor="imageFile">Upload Outfit Image</Label>
            <Input
              ref={fileInputRef}
              id="imageFile"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
            >
              <Upload className="h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Upload</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Take a photo or select from gallery
            </p>
          </div>

          {imagePreview && (
            <div className="aspect-square max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Outfit preview"
                className="w-full h-full object-cover"
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

          {result.extractedHashtags && result.extractedHashtags.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                Extracted Fashion Elements
              </h3>
              <div className="flex flex-wrap gap-2">
                {result.extractedHashtags.map((tag: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.trendEstimates && result.trendEstimates.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                AI Trend Analysis (Gemini Estimates)
              </h3>
              <div className="space-y-2">
                {result.trendEstimates.map((estimate: any, index: number) => (
                  <Card key={index} className="p-3 border-border">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">
                        #{estimate.hashtag}
                      </Badge>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">
                          {estimate.popularityScore}/100
                        </div>
                        <div className="text-xs text-muted-foreground">popularity</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {estimate.context}
                    </p>
                    {estimate.relatedTrends && estimate.relatedTrends.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {estimate.relatedTrends.map((trend: string, i: number) => (
                          <span key={i} className="text-xs bg-accent/50 px-2 py-0.5 rounded">
                            {trend}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {result.verifiedTopTrend && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Verified Top Trend (Google Search)
              </h3>
              <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="text-sm">
                    #{result.verifiedTopTrend.hashtag}
                  </Badge>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {result.verifiedTopTrend.resultCount?.toLocaleString() || 0}
                    </div>
                    <div className="text-xs text-muted-foreground">search results</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  AI Estimate: {result.verifiedTopTrend.estimatedScore}/100
                </div>
                {result.verifiedTopTrend.topResult && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    📰 {result.verifiedTopTrend.topResult}
                  </p>
                )}
              </Card>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Only 1 Serper API call used (saved your quota!)
              </p>
            </div>
          )}

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
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => handleTrendClick(trend)}
                  >
                    #{trend}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <TrendDetailModal
        trend={selectedTrend}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
