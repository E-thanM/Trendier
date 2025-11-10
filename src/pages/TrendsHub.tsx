import TrendsList from "@/components/TrendsList";
import TikTokAnalyzer from "@/components/TikTokAnalyzer";

export default function TrendsHub() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Fashion Trends Hub</h1>
          <p className="text-muted-foreground">
            Discover trending fashion from Google & TikTok videos
          </p>
        </div>

        {/* Merged Trends View */}
        <div className="space-y-8">
          <TrendsList />
          
          <div className="border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">Analyze TikTok Hashtags</h2>
            <TikTokAnalyzer />
          </div>
        </div>
      </div>
    </div>
  );
}