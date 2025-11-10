import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Video } from "lucide-react";
import TrendsList from "@/components/TrendsList";
import TikTokAnalyzer from "@/components/TikTokAnalyzer";

export default function TrendsHub() {
  const [activeTab, setActiveTab] = useState("trends");

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Fashion Trends Hub</h1>
          <p className="text-muted-foreground">
            Explore trends from Google & TikTok, or analyze specific hashtags
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="trends" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Fashion Trends
            </TabsTrigger>
            <TabsTrigger value="analyzer" className="gap-2">
              <Video className="h-4 w-4" />
              Video Analyzer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            <TrendsList />
          </TabsContent>

          <TabsContent value="analyzer">
            <TikTokAnalyzer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}