import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Loader2, TrendingUp, Star, Upload, X, Video, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { TrendDetailModal } from "@/components/TrendDetailModal";

const targetStyleSchema = z.object({
  targetStyle: z.string().trim().min(1, "Target style is required").max(100, "Target style must be less than 100 characters")
});

interface MetricCircleProps {
  value: number;
  maxValue: number;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

const MetricCircle = ({ value, maxValue, label, description, color, icon }: MetricCircleProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const percentage = (value / maxValue) * 100;
  const circumference = 2 * Math.PI * 54; // radius = 54
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  useEffect(() => {
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const colorClasses = {
    primary: {
      text: "text-primary",
      stroke: "stroke-primary",
      bg: "from-primary/10 to-primary/5"
    },
    secondary: {
      text: "text-secondary",
      stroke: "stroke-secondary",
      bg: "from-secondary/10 to-secondary/5"
    },
    "chart-1": {
      text: "text-chart-1",
      stroke: "stroke-chart-1",
      bg: "from-chart-1/10 to-chart-1/5"
    }
  };

  const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.primary;

  return (
    <Card className={`p-6 border-border bg-gradient-to-br ${colors.bg}`}>
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32 mb-4">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="54"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-muted/20"
            />
            <circle
              cx="64"
              cy="64"
              r="54"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${colors.stroke} transition-all duration-1000 ease-out`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`mb-1 ${colors.text}`}>
              {icon}
            </div>
            <div className={`text-3xl font-bold ${colors.text}`}>
              {displayValue}
            </div>
            <div className="text-xs text-muted-foreground">
              / {maxValue}
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <div className="font-semibold mb-1">
            {label}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
};

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
      // Check file extension first
      const fileName = file.name.toLowerCase();
      const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const hasValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasValidExtension) {
        toast({
          title: "Unsupported Format",
          description: "Please use JPG, PNG, WEBP, or GIF format. AVIF and HEIC are not supported.",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    } catch (error: any) {
      console.error("Error analyzing outfit:", error);
      const errorMessage = error?.message || error?.error || "Failed to analyze outfit. Please try again.";
      toast({
        title: "Analysis Failed",
        description: errorMessage,
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
              accept=".jpg,.jpeg,.png,.gif,.webp"
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
            <div className="relative aspect-square max-w-md mx-auto bg-muted rounded-lg overflow-hidden group">
              <img
                src={imagePreview}
                alt="Outfit preview"
                className="w-full h-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveImage}
              >
                <X className="h-4 w-4" />
              </Button>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <MetricCircle 
              value={result.rating || 0}
              maxValue={100}
              label="Style Match"
              description="How well your outfit matches your target style aesthetic"
              color="primary"
              icon={<Star className="h-5 w-5" />}
            />
            
            <MetricCircle 
              value={result.trendMatch || 0}
              maxValue={100}
              label="Trend Score"
              description="Overall trendiness based on current fashion trends"
              color="secondary"
              icon={<TrendingUp className="h-5 w-5" />}
            />

            <MetricCircle 
              value={result.tiktokTrendScore || 0}
              maxValue={100}
              label="TikTok Viral"
              description={`Based on ${result.tiktokMatches?.length || 0} items trending in real TikTok videos`}
              color="chart-1"
              icon={<Video className="h-5 w-5" />}
            />
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
                        {estimate.searchTerm || estimate.hashtag}
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

          {result.googleTrendsData && result.googleTrendsData.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-chart-2" />
                Google Trends Insights
              </h3>
              <div className="space-y-3">
                {result.googleTrendsData
                  .filter((trend: any) => trend.snippet || trend.trendingTopics?.length > 0 || trend.trendsUrl)
                  .map((trend: any, index: number) => (
                  <Card key={index} className="p-4 border-chart-2/30 bg-gradient-to-br from-chart-2/5 to-chart-1/5">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-sm border-chart-2">
                        #{trend.searchTerm}
                      </Badge>
                      {trend.trendsUrl && (
                        <a 
                          href={trend.trendsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-chart-2 hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Trends
                        </a>
                      )}
                    </div>
                    {trend.snippet && (
                      <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                        {trend.snippet}
                      </p>
                    )}
                    {trend.trendingTopics && trend.trendingTopics.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Related Topics:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {trend.trendingTopics.slice(0, 3).map((topic: string, i: number) => (
                            <span key={i} className="text-xs bg-chart-2/20 text-foreground px-2 py-1 rounded">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Real-time trend data from Google Trends
              </p>
            </div>
          )}

          {result.verifiedTopTrend && result.verifiedTopTrend.resultCount > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Verified Trend
              </h3>
              <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
                <div className="flex items-center justify-between mb-3">
                  <Badge className="text-sm">
                    #{result.verifiedTopTrend.searchTerm}
                  </Badge>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {result.verifiedTopTrend.resultCount.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">search results</div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  AI Estimate: {result.verifiedTopTrend.estimatedScore}/100
                </div>
                {result.verifiedTopTrend.topResult && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    📰 {result.verifiedTopTrend.topResult}
                  </p>
                )}
                {result.verifiedTopTrend.trendingTopics && 
                 result.verifiedTopTrend.trendingTopics.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">
                      Related Trending Topics:
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {result.verifiedTopTrend.trendingTopics.slice(0, 3).map((topic: string, i: number) => (
                        <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Verified with real-time search data
              </p>
            </div>
          )}

          {result.tiktokMatches && result.tiktokMatches.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Video className="h-4 w-4 text-chart-1" />
                TikTok Viral Score Breakdown
              </h3>
              
              <Card className="p-4 mb-4 border-chart-1/30 bg-gradient-to-br from-chart-1/10 to-chart-2/10">
                <div className="text-center mb-3">
                  <div className="text-4xl font-bold text-chart-1 mb-1">
                    {result.tiktokTrendScore}/100
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average TikTok Trend Score
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Calculated from {result.tiktokMatches.length} matching items in real TikTok videos
                  </p>
                </div>
              </Card>

              <div className="space-y-3">
                {result.tiktokMatches.map((match: any, index: number) => (
                  <Card key={index} className="p-4 border-chart-1/30 bg-gradient-to-br from-chart-1/5 to-chart-2/5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="text-xs bg-chart-1">
                            {match.itemName}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {match.category}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Featured in videos by <span className="font-medium">@{match.author}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-chart-1">
                          {match.trendScore}
                        </div>
                        <div className="text-xs text-muted-foreground">score</div>
                      </div>
                    </div>
                    {match.videoUrl && (
                      <a 
                        href={match.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-chart-1 hover:underline inline-flex items-center gap-1"
                      >
                        Watch on TikTok <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </Card>
                ))}
              </div>
              
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Items detected from analyzing actual TikTok fashion video content
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
