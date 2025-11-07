import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";

export default function Trends() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scrapeTrends();
  }, []);

  const scrapeTrends = async () => {
    try {
      // First scrape/update trends
      await supabase.functions.invoke('scrape-trends');
      
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Trending Now
        </h1>
        <p className="text-sm text-muted-foreground">
          Latest fashion trends from TikTok & Instagram
        </p>
      </div>

      {trends.length === 0 ? (
        <Card className="p-12 text-center border-border">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            No trends available yet. Check back soon!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {trends.map((trend) => (
            <Card key={trend.id} className="p-5 border-border hover:border-primary/50 transition-all hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-base">{trend.name}</h3>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold shrink-0">
                  {trend.popularity_score}
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
              
              {trend.source && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  {trend.source}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
