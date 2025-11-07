import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2 } from "lucide-react";

export default function Trends() {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
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
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <TrendingUp className="h-8 w-8" />
          Trending Now
        </h1>
        <p className="text-muted-foreground">
          See what's hot in fashion right now
        </p>
      </div>

      {trends.length === 0 ? (
        <Card className="p-12 text-center">
          <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            No trends available yet. Check back soon!
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trends.map((trend) => (
            <Card key={trend.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg">{trend.name}</h3>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                  {trend.popularity_score}
                </div>
              </div>
              
              {trend.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {trend.description}
                </p>
              )}
              
              {trend.tags && trend.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {trend.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="text-xs bg-muted px-2 py-1 rounded-full"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              
              {trend.source && (
                <p className="text-xs text-muted-foreground mt-3">
                  Source: {trend.source}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
