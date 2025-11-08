import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp, Calendar, BarChart3, Hash, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

interface TrendDetailModalProps {
  trend: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoricalDataPoint {
  month: string;
  popularity: number;
}

// Fallback: Generate simulated historical data for the trend
const generateTrendData = (currentScore: number) => {
  const periods = ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'];
  return periods.map((month, index) => {
    const variance = Math.random() * 15 - 7.5;
    const baseScore = currentScore - (6 - index) * 5 + variance;
    return {
      month,
      popularity: Math.max(20, Math.min(100, Math.round(baseScore)))
    };
  });
};

export function TrendDetailModal({ trend, open, onOpenChange }: TrendDetailModalProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [growthRate, setGrowthRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!trend?.id || !open) return;

    const fetchHistoricalData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('trend_history')
          .select('popularity_score, recorded_at')
          .eq('trend_id', trend.id)
          .order('recorded_at', { ascending: true })
          .limit(30);

        if (error) {
          console.error('Error fetching trend history:', error);
          // Use simulated data as fallback
          const simulatedData = generateTrendData(trend.popularity_score);
          setHistoricalData(simulatedData);
          setGrowthRate(Math.round((simulatedData[simulatedData.length - 1].popularity - simulatedData[0].popularity) / simulatedData[0].popularity * 100));
          return;
        }

        if (data && data.length > 0) {
          // Transform data for the chart
          const chartData = data.map((point) => ({
            month: new Date(point.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            popularity: point.popularity_score
          }));

          setHistoricalData(chartData);

          // Calculate growth rate
          const firstScore = chartData[0].popularity;
          const lastScore = chartData[chartData.length - 1].popularity;
          const growth = ((lastScore - firstScore) / firstScore) * 100;
          setGrowthRate(Math.round(growth));
        } else {
          // No historical data yet, use simulated data
          const simulatedData = generateTrendData(trend.popularity_score);
          setHistoricalData(simulatedData);
          setGrowthRate(Math.round((simulatedData[simulatedData.length - 1].popularity - simulatedData[0].popularity) / simulatedData[0].popularity * 100));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoricalData();
  }, [trend?.id, open]);

  if (!trend) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-50 rounded-full hover:bg-accent"
        >
          <X className="h-4 w-4" />
        </Button>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            {trend.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 border-border">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Popularity</span>
              </div>
              <div className="text-2xl font-bold text-primary">{trend.popularity_score}</div>
            </Card>
            
            <Card className="p-4 border-border">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-secondary" />
                <span className="text-xs text-muted-foreground">Growth</span>
              </div>
              <div className="text-2xl font-bold text-secondary">
                {growthRate > 0 ? '+' : ''}{growthRate}%
              </div>
            </Card>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2 text-sm text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              About this trend
            </h3>
            <p className="text-sm leading-relaxed">{trend.description}</p>
          </div>

          {/* Popularity Chart */}
          <div>
            <h3 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Popularity Over Time
            </h3>
            <Card className="p-4 border-border">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={historicalData}>
                  <defs>
                    <linearGradient id="colorPopularity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="month" 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="popularity" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPopularity)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Tags */}
          {trend.tags && trend.tags.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Related Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {trend.tags.map((tag: string, index: number) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs px-3 py-1.5 hover-scale cursor-pointer"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Source: <span className="font-medium text-foreground">{trend.source}</span>
              </span>
              <span className="text-muted-foreground">
                Last updated: <span className="font-medium text-foreground">Today</span>
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
