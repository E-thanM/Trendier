import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApifyTrendItem {
  hashtag?: string;
  description?: string;
  viewCount?: number;
  tags?: string[];
}

async function scrapeTrendsFromApify(apiKey: string): Promise<any[]> {
  try {
    console.log('Starting Apify scrape...');
    
    // Start Apify actor run for TikTok/Instagram fashion trends
    const actorRunResponse = await fetch('https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        hashtags: ['fashion', 'ootd', 'style', 'fashiontrends', 'fashioninspo'],
        resultsLimit: 50,
      }),
    });

    if (!actorRunResponse.ok) {
      throw new Error(`Apify actor start failed: ${actorRunResponse.statusText}`);
    }

    const runData = await actorRunResponse.json();
    const runId = runData.data.id;
    console.log(`Apify run started: ${runId}`);

    // Wait for the run to complete (poll for status)
    let isFinished = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait
    
    while (!isFinished && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      
      const statusData = await statusResponse.json();
      isFinished = statusData.data.status === 'SUCCEEDED' || statusData.data.status === 'FAILED';
      attempts++;
      
      console.log(`Run status: ${statusData.data.status}, attempt ${attempts}`);
    }

    // Fetch the results
    const resultsResponse = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!resultsResponse.ok) {
      throw new Error(`Failed to fetch results: ${resultsResponse.statusText}`);
    }

    const results = await resultsResponse.json();
    console.log(`Retrieved ${results.length} items from Apify`);
    
    return results;
  } catch (error) {
    console.error('Apify scraping error:', error);
    throw error;
  }
}

function extractTrendsFromApifyData(apifyData: ApifyTrendItem[]): any[] {
  // Group by hashtags and aggregate data
  const trendMap = new Map<string, any>();
  
  apifyData.forEach((item: ApifyTrendItem) => {
    const hashtag = item.hashtag || 'Unknown';
    const views = item.viewCount || 0;
    
    if (trendMap.has(hashtag)) {
      const existing = trendMap.get(hashtag);
      existing.popularity_score += Math.min(views / 1000000, 10); // Scale views to score
      existing.tags = [...new Set([...existing.tags, ...(item.tags || [])])];
    } else {
      trendMap.set(hashtag, {
        name: hashtag.replace('#', '').replace(/([A-Z])/g, ' $1').trim(),
        description: item.description || `Trending style featuring ${hashtag}`,
        tags: item.tags || [hashtag.toLowerCase()],
        source: 'Instagram',
        popularity_score: Math.min(views / 1000000, 100),
      });
    }
  });

  return Array.from(trendMap.values())
    .sort((a, b) => b.popularity_score - a.popularity_score)
    .slice(0, 15); // Top 15 trends
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting trend scraping process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const apifyApiKey = Deno.env.get('APIFY_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    let trendingStyles: any[];

    if (apifyApiKey) {
      console.log('Using Apify API to scrape real trends...');
      try {
        const apifyData = await scrapeTrendsFromApify(apifyApiKey);
        trendingStyles = extractTrendsFromApifyData(apifyData);
        console.log(`Extracted ${trendingStyles.length} trends from Apify data`);
      } catch (apifyError) {
        console.error('Apify scraping failed, falling back to default trends:', apifyError);
        trendingStyles = getDefaultTrends();
      }
    } else {
      console.log('No Apify API key found, using default trends');
      trendingStyles = getDefaultTrends();
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

    console.log(`Successfully scraped and stored ${data?.length || 0} trends`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        trendsCount: data?.length || 0,
        trends: data,
        source: apifyApiKey ? 'apify' : 'default',
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
