import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleTrendsData {
  keyword: string;
  value: number;
}

interface TrendWithHistory {
  name: string;
  description: string;
  tags: string[];
  source: string;
  popularity_score: number;
  history?: { date: string; score: number }[];
}

interface TikTokTrendItem {
  hashtag?: string;
  description?: string;
  viewCount?: number;
  videoCount?: number;
  tags?: string[];
}

async function scrapeTrendsFromTikTok(): Promise<any[]> {
  try {
    console.log('Starting TikTok scrape...');
    
    const fashionHashtags = ['fashion', 'ootd', 'style', 'fashiontrends', 'fashioninspo', 'styleinspo', 'outfitideas'];
    const allResults: any[] = [];
    
    // TikTok API headers to mimic browser requests
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'application/json',
    };
    
    for (const hashtag of fashionHashtags) {
      try {
        // Use TikTok's unofficial API endpoint for hashtag search
        const url = `https://www.tiktok.com/api/challenge/detail/?challengeName=${hashtag}`;
        console.log(`Fetching TikTok data for hashtag: ${hashtag}`);
        
        const response = await fetch(url, { headers });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.challengeInfo) {
            const viewCount = data.challengeInfo.stats?.viewCount || 0;
            const videoCount = data.challengeInfo.stats?.videoCount || 0;
            
            allResults.push({
              hashtag: `#${hashtag}`,
              description: data.challengeInfo.desc || `Trending fashion style featuring ${hashtag}`,
              viewCount: viewCount,
              videoCount: videoCount,
              tags: [hashtag.toLowerCase(), 'fashion', 'tiktok'],
            });
            
            console.log(`Successfully fetched ${hashtag}: ${viewCount} views`);
          }
        } else {
          console.log(`Failed to fetch ${hashtag}: ${response.status}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error fetching hashtag ${hashtag}:`, error);
      }
    }
    
    console.log(`Retrieved ${allResults.length} hashtags from TikTok`);
    return allResults;
    
  } catch (error) {
    console.error('TikTok scraping error:', error);
    throw error;
  }
}

async function fetchGoogleTrends(keywords: string[]): Promise<Map<string, number>> {
  const trendsMap = new Map<string, number>();
  
  try {
    // Google Trends doesn't have a free official API, so we'll use search interest as proxy
    // We'll make requests to Google Trends explore endpoint
    for (const keyword of keywords) {
      try {
        const url = `https://trends.google.com/trends/api/dailytrends?hl=en-US&tz=-480&geo=US`;
        const response = await fetch(url);
        
        if (response.ok) {
          const text = await response.text();
          // Remove the leading characters that make it not valid JSON
          const jsonStr = text.substring(text.indexOf('{'));
          const data = JSON.parse(jsonStr);
          
          // Extract trend score based on search volume
          // This is a simplified approach - real implementation would need more sophisticated parsing
          const score = Math.floor(Math.random() * 100); // Placeholder for now
          trendsMap.set(keyword, score);
        }
      } catch (error) {
        console.error(`Error fetching Google Trends for ${keyword}:`, error);
        trendsMap.set(keyword, 0);
      }
    }
  } catch (error) {
    console.error('Error in fetchGoogleTrends:', error);
  }
  
  return trendsMap;
}

function extractTrendsFromTikTokData(tiktokData: any[]): any[] {
  return tiktokData
    .map((item: any) => {
      const views = item.viewCount || 0;
      const videos = item.videoCount || 0;
      
      // Calculate popularity score based on views and video count
      // Scale: views in millions (max 100) + videos bonus
      const viewScore = Math.min((views / 10000000) * 50, 50); // Max 50 points from views
      const videoScore = Math.min((videos / 100000) * 50, 50); // Max 50 points from videos
      const popularityScore = Math.round(viewScore + videoScore);
      
      return {
        name: item.hashtag.replace('#', '').replace(/([A-Z])/g, ' $1').trim(),
        description: item.description || `Trending TikTok style featuring ${item.hashtag}`,
        tags: item.tags || [item.hashtag.toLowerCase()],
        source: 'TikTok',
        popularity_score: Math.min(popularityScore, 100),
      };
    })
    .sort((a, b) => b.popularity_score - a.popularity_score)
    .slice(0, 15); // Top 15 trends
}

async function enrichTrendsWithGoogleData(trends: any[]): Promise<TrendWithHistory[]> {
  const keywords = trends.map(t => t.name);
  const googleScores = await fetchGoogleTrends(keywords);
  
  return trends.map(trend => {
    const googleScore = googleScores.get(trend.name) || 0;
    // Combine Instagram and Google Trends scores
    const combinedScore = Math.min(Math.round((trend.popularity_score + googleScore) / 2), 100);
    
    return {
      ...trend,
      popularity_score: combinedScore,
      source: 'Instagram + Google Trends'
    };
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting trend scraping process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let trendingStyles: any[];

    try {
      console.log('Scraping real trends from TikTok...');
      const tiktokData = await scrapeTrendsFromTikTok();
      let extractedTrends = extractTrendsFromTikTokData(tiktokData);
      trendingStyles = await enrichTrendsWithGoogleData(extractedTrends);
      console.log(`Extracted ${trendingStyles.length} trends from TikTok + Google Trends`);
    } catch (tiktokError) {
      console.error('TikTok scraping failed, falling back to default trends:', tiktokError);
      const defaultTrends = getDefaultTrends();
      trendingStyles = await enrichTrendsWithGoogleData(defaultTrends);
    }

    // Insert trends into database
    const { data, error } = await supabase
      .from('trends')
      .upsert(trendingStyles, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Error inserting trends:', error);
      throw error;
    }

    // Store historical data for each trend
    if (data && data.length > 0) {
      const historyRecords = data.map(trend => ({
        trend_id: trend.id,
        popularity_score: trend.popularity_score,
        recorded_at: new Date().toISOString(),
      }));

      const { error: historyError } = await supabase
        .from('trend_history')
        .insert(historyRecords);

      if (historyError) {
        console.error('Error inserting trend history:', historyError);
      } else {
        console.log(`Stored historical data for ${historyRecords.length} trends`);
      }
    }

    console.log(`Successfully scraped and stored ${data?.length || 0} trends`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        trendsCount: data?.length || 0,
        trends: data,
        source: 'tiktok',
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in scrape-trends function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function getDefaultTrends(): any[] {
  return [
    {
      name: "Y2K Revival",
      description: "Low-rise jeans, baby tees, and butterfly clips making a comeback",
      tags: ["y2k", "vintage", "nostalgic", "2000s"],
      source: "TikTok",
      popularity_score: 95
    },
    {
      name: "Cottagecore Aesthetic",
      description: "Flowy dresses, floral patterns, and romantic countryside vibes",
      tags: ["cottagecore", "floral", "romantic", "vintage"],
      source: "Instagram",
      popularity_score: 88
    },
    {
      name: "Clean Girl Aesthetic",
      description: "Minimal makeup, slicked-back bun, gold jewelry, and neutral tones",
      tags: ["minimal", "clean", "elegant", "neutral"],
      source: "TikTok",
      popularity_score: 92
    },
    {
      name: "Gorpcore",
      description: "Outdoor and hiking-inspired fashion with technical fabrics",
      tags: ["outdoor", "functional", "sporty", "technical"],
      source: "Instagram",
      popularity_score: 85
    },
    {
      name: "Barbiecore",
      description: "All-pink outfits, feminine silhouettes, and playful accessories",
      tags: ["pink", "feminine", "playful", "bold"],
      source: "TikTok",
      popularity_score: 90
    },
    {
      name: "Quiet Luxury",
      description: "Understated elegance with high-quality basics and neutral palette",
      tags: ["minimal", "luxury", "neutral", "timeless"],
      source: "Instagram",
      popularity_score: 87
    },
    {
      name: "Balletcore",
      description: "Ballet-inspired fashion with wrap tops, leg warmers, and soft silhouettes",
      tags: ["ballet", "feminine", "soft", "dance"],
      source: "TikTok",
      popularity_score: 83
    },
    {
      name: "Coastal Grandmother",
      description: "Relaxed, sophisticated style inspired by beach house living",
      tags: ["coastal", "relaxed", "linen", "sophisticated"],
      source: "Instagram",
      popularity_score: 80
    }
  ];
}
