import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TrendingUp, Video, Hash, Award, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ClothingItem {
  name: string;
  category: string;
  confidence: number;
  trendScore: number;
}

interface VideoAnalysis {
  videoId: string;
  videoUrl: string;
  author: string;
  description: string;
  detectedItems: ClothingItem[];
  overallTrendScore: number;
  trendingItems: string[];
  rank: number;
  percentile: number;
}

interface AnalysisResult {
  hashtag: string;
  totalVideos: number;
  analyses: VideoAnalysis[];
  summary: {
    mostTrendyVideo: VideoAnalysis;
    averageTrendScore: number;
    topItems: { name: string; occurrences: number; avgTrendScore: number }[];
  };
}

export default function TikTokTrends() {
  const [hashtag, setHashtag] = useState("");
  const [maxVideos, setMaxVideos] = useState(10);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!hashtag.trim()) {
      toast({
        title: "Error",
        description: "Please enter a hashtag",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'analyze-tiktok-trends',
        {
          body: {
            hashtag: hashtag.replace('#', ''),
            maxVideos
          }
        }
      );

      if (functionError) throw functionError;

      if (functionData.error) {
        throw new Error(functionData.error);
      }

      setResult(functionData);
      toast({
        title: "Analysis Complete",
        description: `Analyzed ${functionData.totalVideos} videos`,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze videos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      tops: "bg-blue-500",
      bottoms: "bg-green-500",
      shoes: "bg-purple-500",
      accessories: "bg-yellow-500",
      outerwear: "bg-red-500",
    };
    return colors[category.toLowerCase()] || "bg-gray-500";
  };

  const getTrendScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-600 dark:text-gray-400";
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Video className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">TikTok Trend Analyzer</h1>
          </div>
          <p className="text-muted-foreground">
            Analyze fashion trends from TikTok videos using AI
          </p>
        </div>

        <Card className="p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Hashtag to Analyze
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="fashion, ootd, streetwear..."
                    value={hashtag}
                    onChange={(e) => setHashtag(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={maxVideos}
                  onChange={(e) => setMaxVideos(parseInt(e.target.value) || 10)}
                  className="w-24"
                  disabled={loading}
                  placeholder="Videos"
                />
              </div>
            </div>

            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing Videos...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analyze Trends
                </>
              )}
            </Button>
          </div>
        </Card>

        {result && (
          <div className="space-y-6">
            {/* Summary Card */}
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">
                Analysis Summary: #{result.hashtag}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-primary">
                    {result.totalVideos}
                  </div>
                  <div className="text-sm text-muted-foreground">Videos Analyzed</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-primary">
                    {result.summary.averageTrendScore}
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Trend Score</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-primary">
                    {result.summary.topItems.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Unique Items</div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Top Trending Items</h3>
                <div className="space-y-2">
                  {result.summary.topItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <Award className="h-4 w-4 text-primary" />
                        <span className="font-medium capitalize">{item.name}</span>
                      </div>
                      <Badge variant="secondary">
                        {item.occurrences} videos
                      </Badge>
                      <div className={`font-bold ${getTrendScoreColor(item.avgTrendScore)}`}>
                        {item.avgTrendScore}/100
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Video Analyses */}
            <div>
              <h2 className="text-2xl font-bold mb-4">Video Rankings</h2>
              <div className="space-y-4">
                {result.analyses.map((analysis) => (
                  <Card key={analysis.videoId} className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-2xl font-bold text-primary">
                            #{analysis.rank}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold">@{analysis.author}</h3>
                          <Badge variant="outline">
                            Top {analysis.percentile}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {analysis.description}
                        </p>
                        <a
                          href={analysis.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          View Video <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getTrendScoreColor(analysis.overallTrendScore)}`}>
                          {analysis.overallTrendScore}
                        </div>
                        <div className="text-sm text-muted-foreground">Trend Score</div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <Progress value={analysis.overallTrendScore} className="h-2" />
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2 text-sm">Detected Items:</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysis.detectedItems.map((item, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className={`${getCategoryColor(item.category)} text-white`}
                          >
                            {item.name} ({item.trendScore})
                          </Badge>
                        ))}
                      </div>
                      {analysis.trendingItems.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm font-medium text-primary">
                            Matches Trends: {analysis.trendingItems.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
