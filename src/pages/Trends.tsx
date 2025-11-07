import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Loader2, Search, BarChart3 } from "lucide-react";
import { TrendDetailModal } from "@/components/TrendDetailModal";

export default function Trends() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrend, setSelectedTrend] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    scrapeTrends();
  }, []);

  const scrapeTrends = async () => {
    try {
      // First scrape/update trends (no authentication required)
      const { error: invokeError } = await supabase.functions.invoke('scrape-trends');

      if (invokeError) {
        console.error("Error invoking scrape-trends:", invokeError);
      }
      
      // Then fetch them
      const { data, error } = await supabase
        .from("trends")
        .select("*")
        .order("popularity_score", { ascending: false })
        .limit(20);

      if (error) {
        console.error("Error fetching trends:", error);
      } else {
        setTrends(data || []);
      }
    } catch (error) {
      console.error("Error scraping trends:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrends = trends.filter(trend => 
    trend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trend.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    trend.tags?.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const popularTrends = [...trends].sort((a, b) => b.popularity_score - a.popularity_score).slice(0, 5);

  const handleTrendClick = (trend: any) => {
    setSelectedTrend(trend);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24 md:pb-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Fashion Trends
        </h1>
        <p className="text-sm text-muted-foreground">
          Latest trends from TikTok & Instagram
        </p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="all">All Trends</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredTrends.length === 0 ? (
            <Card className="p-12 text-center border-border">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No trends found matching your search
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredTrends.map((trend) => (
                <Card 
                  key={trend.id} 
                  className="p-5 border-border hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer hover-scale active:scale-95" 
                  onClick={() => handleTrendClick(trend)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-base">{trend.name}</h3>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold">
                        {trend.popularity_score}
                      </div>
                    </div>
                  </div>
                  
                  {trend.description && (
                    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                      {trend.description}
                    </p>
                  )}
                  
                  {trend.tags && trend.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {trend.tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs bg-accent text-accent-foreground px-2.5 py-1 rounded-full font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        {trend.source}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          Popularity trend: 
                          <span className="text-primary font-medium ml-1">↑ {Math.round(trend.popularity_score * 0.12)}%</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top 5 Trending Styles
            </h2>
            <div className="space-y-4">
              {popularTrends.map((trend, index) => (
                <Card 
                  key={trend.id} 
                  className="p-4 border-border cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg hover-scale active:scale-95"
                  onClick={() => handleTrendClick(trend)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center font-bold text-lg">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{trend.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {trend.description?.slice(0, 80)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {trend.popularity_score}
                      </div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                        style={{ width: `${trend.popularity_score}%` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <TrendDetailModal 
        trend={selectedTrend} 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
      />
    </div>
  );
}
