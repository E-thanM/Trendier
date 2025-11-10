import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, BarChart3, RefreshCw, TrendingUp } from "lucide-react";
import { TrendDetailModal } from "@/components/TrendDetailModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function TrendsList() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrend, setSelectedTrend] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTrends();

    const channel = supabase
      .channel('trends-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trends'
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setTrends(prev => {
              const newTrend = payload.new as any;
              const existingIndex = prev.findIndex(t => t.id === newTrend.id);
              if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = newTrend;
                return updated;
              } else {
                return [newTrend, ...prev];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTrends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trends")
        .select("*")
        .order("popularity_score", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Error fetching trends:", error);
      } else {
        setTrends(data || []);
      }
    } catch (error) {
      console.error("Error fetching trends:", error);
    } finally {
      setLoading(false);
    }
  };

  const scrapeTrends = async () => {
    setScraping(true);
    try {
      toast({
        title: "Refreshing trends...",
        description: "Discovering latest fashion trends from TikTok and Google",
      });

      const { data, error: invokeError } = await supabase.functions.invoke('scrape-trends');

      if (invokeError) {
        console.error("Error invoking scrape-trends:", invokeError);
        toast({
          title: "Error refreshing trends",
          description: invokeError.message,
          variant: "destructive",
        });
      } else {
        const source = data?.source || 'unknown';
        const trendsCount = data?.trendsCount || 0;
        
        if (source === 'cache') {
          toast({
            title: "Using cached trends",
            description: `${trendsCount} trends loaded from cache (less than 7 days old)`,
          });
        } else {
          toast({
            title: "Trends updated!",
            description: `Successfully discovered ${trendsCount} fresh trends`,
          });
        }
      }
      
      await fetchTrends();
    } catch (error) {
      console.error("Error scraping trends:", error);
      toast({
        title: "Error",
        description: "Failed to refresh trends",
        variant: "destructive",
      });
    } finally {
      setScraping(false);
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Latest trends from TikTok & Google
        </p>
        <Button 
          onClick={scrapeTrends} 
          disabled={scraping}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${scraping ? 'animate-spin' : ''}`} />
          {scraping ? 'Refreshing...' : 'Refresh'}
        </Button>
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