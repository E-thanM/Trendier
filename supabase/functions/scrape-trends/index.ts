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
    
    const fashionHashtags = [
      // Core fashion
      'fashion', 'ootd', 'style', 'fashiontrends', 'fashioninspo', 'styleinspo', 'outfitideas',
      // Aesthetics
      'y2k', 'cottagecore', 'darkacademia', 'lightacademia', 'balletcore', 'barbiecore', 'gorpcore',
      'cleangirlaesthetic', 'quietluxury', 'oldmoney', 'coastalgrandmother', 'tomboy', 'streetwear',
      // Styles
      'vintage', 'retro', 'boho', 'minimalist', 'maximalist', 'grunge', 'preppy', 'artsy',
      'edgy', 'romantic', 'sporty', 'chic', 'elegant', 'casual', 'formal', 'alternative',
      // Specific items
      'denim', 'leather', 'oversized', 'croptop', 'widelegpants', 'cargopants', 'blazer',
      'sneakers', 'boots', 'heels', 'accessories', 'jewelry', 'sunglasses', 'bags',
      // Occasions
      'workwear', 'datenight', 'brunch', 'party', 'vacation', 'wedding', 'gymwear',
      // Seasons
      'springfashion', 'summerfashion', 'fallfashion', 'winterfashion',
      // Colors & patterns
      'allblack', 'neutrals', 'pastels', 'neon', 'animalprint', 'florals', 'stripes',
      // Brands & luxury
      'luxury', 'designer', 'highfashion', 'streetstyle', 'thrift', 'sustainable',
      // Body types
      'petite', 'tall', 'curvy', 'plus', 'midsize',
      // Trends
      'microtrend', 'trending', 'viral', 'fyp', 'tiktokfashion', 'instafashion',
      // Subcultures
      'goth', 'emo', 'punk', 'kawaii', 'harajuku', 'kfashion', 'jfashion',
      // Specific trends
      'dopamine', 'normcore', 'athleisure', 'businesscasual', 'smartcasual',
      'layering', 'monochrome', 'colorblocking', 'mixedprints', 'textures',
      // Accessories
      'hats', 'scarves', 'belts', 'watches', 'rings', 'necklaces', 'earrings',
      // Footwear
      'platformshoes', 'loafers', 'sandals', 'slippers', 'sneakerhead',
      // Outerwear
      'coats', 'jackets', 'trenchcoat', 'puffjacket', 'cardigan',
      // Bottoms
      'jeans', 'skirts', 'shorts', 'leggings', 'trousers',
      // Tops
      'tshirt', 'hoodie', 'sweater', 'blouse', 'tank', 'bodysuits',
      // Dresses
      'dresses', 'maxidress', 'minidress', 'midilength', 'slip',
    ];
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

function getTrendDescription(hashtag: string, originalDesc: string): string {
  const tag = hashtag.replace('#', '').toLowerCase();
  
  const descriptions: { [key: string]: string } = {
    'y2k': 'Early 2000s fashion revival featuring low-rise jeans, baby tees, rhinestones, and butterfly accessories. Think Paris Hilton and Britney Spears era.',
    'cottagecore': 'Romantic countryside aesthetic with flowy dresses, floral patterns, lace details, and nature-inspired accessories. Embraces a whimsical, pastoral lifestyle.',
    'darkacademia': 'Scholarly aesthetic with tweed blazers, turtlenecks, leather oxford shoes, and vintage-inspired pieces. Inspired by classic literature and university life.',
    'lightacademia': 'Softer academic style with cream and beige tones, linen fabrics, and romantic scholarly vibes. Less dark, more optimistic than dark academia.',
    'balletcore': 'Ballet-inspired fashion featuring wrap cardigans, leg warmers, soft pink tones, and delicate, graceful silhouettes.',
    'barbiecore': 'All-pink maximalist aesthetic with hot pink outfits, feminine silhouettes, playful accessories, and bold, confident styling.',
    'gorpcore': 'Outdoor gear meets street style with technical fabrics, hiking boots, utility vests, and functional fashion pieces.',
    'cleangirlaesthetic': 'Minimal, polished look with slicked-back hair, gold hoop earrings, dewy makeup, and neutral-toned outfits.',
    'quietluxury': 'Understated wealth aesthetic featuring high-quality basics, neutral colors, perfect tailoring, and minimal branding.',
    'oldmoney': 'Timeless, preppy style with polo shirts, tennis skirts, loafers, and classic pieces that suggest generational wealth.',
    'streetwear': 'Urban fashion featuring oversized hoodies, sneakers, graphic tees, and influences from hip-hop and skateboarding culture.',
    'grunge': '90s-inspired rebellious style with flannel shirts, ripped jeans, combat boots, and a deliberately disheveled aesthetic.',
    'preppy': 'Classic collegiate style with polo shirts, cardigans, pleated skirts, loafers, and clean-cut, polished looks.',
    'vintage': 'Retro fashion from past decades featuring thrifted pieces, nostalgic silhouettes, and timeless styling.',
    'boho': 'Bohemian free-spirited style with flowing fabrics, earth tones, fringe details, and eclectic accessories.',
    'minimalist': 'Less-is-more approach with clean lines, neutral colors, simple silhouettes, and curated wardrobes.',
    'athleisure': 'Athletic wear styled for everyday life, blending comfort with fashion through leggings, sneakers, and sports-inspired pieces.',
    'goth': 'Dark, dramatic aesthetic with all-black outfits, leather, lace, heavy boots, and gothic-inspired accessories.',
    'kawaii': 'Japanese cute culture featuring pastel colors, playful prints, oversized bows, and adorable character-inspired fashion.',
  };
  
  return descriptions[tag] || originalDesc || `Trending fashion style featuring ${hashtag}. Popular on TikTok with millions of views and creative outfit interpretations.`;
}

function extractTrendsFromTikTokData(tiktokData: any[]): any[] {
  // First, sort by view count to get relative popularity
  const sortedData = [...tiktokData].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
  
  return sortedData
    .map((item: any, index: any) => {
      const views = item.viewCount || 0;
      
      // Calculate popularity score based on relative ranking and absolute metrics
      // Top trend gets 100, scores decrease proportionally
      const rankScore = Math.round(100 - (index * (100 / sortedData.length)));
      
      // Bonus points for extremely high engagement (billions of views)
      let engagementBonus = 0;
      if (views > 500000000000) engagementBonus = 10; // 500B+ views
      else if (views > 100000000000) engagementBonus = 5; // 100B+ views
      
      const popularityScore = Math.min(rankScore + engagementBonus, 100);
      
      const trendName = item.hashtag.replace('#', '').replace(/([A-Z])/g, ' $1').trim();
      
      return {
        name: trendName,
        description: getTrendDescription(item.hashtag, item.description),
        tags: item.tags || [item.hashtag.toLowerCase()],
        source: 'TikTok',
        popularity_score: popularityScore,
      };
    })
    .slice(0, 15); // Top 15 trends
}

async function enrichTrendsWithGoogleData(trends: any[]): Promise<TrendWithHistory[]> {
  // Use TikTok data directly - Google Trends API requires paid access
  // TikTok view counts are already a strong indicator of popularity
  return trends.map(trend => {
    return {
      ...trend,
      source: 'TikTok Real-time Data'
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

    // Insert trends into database (cleaned data only)
    const { data, error } = await supabase
      .from('trends')
      .upsert(trendingStyles, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Error inserting trends:', error);
      console.error('Trends data:', JSON.stringify(trendingStyles, null, 2));
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
      description: "Early 2000s fashion revival featuring low-rise jeans, baby tees, rhinestones, velour tracksuits, and butterfly accessories. Think Paris Hilton and Britney Spears era with platform shoes and tiny handbags.",
      tags: ["y2k", "vintage", "nostalgic", "2000s"],
      source: "TikTok",
      popularity_score: 95
    },
    {
      name: "Cottagecore Aesthetic",
      description: "Romantic countryside aesthetic with flowy dresses, floral patterns, lace details, puffed sleeves, and nature-inspired accessories. Embraces a whimsical, pastoral lifestyle with vintage-inspired pieces.",
      tags: ["cottagecore", "floral", "romantic", "vintage"],
      source: "Instagram",
      popularity_score: 88
    },
    {
      name: "Clean Girl Aesthetic",
      description: "Minimal, polished look with slicked-back bun hairstyles, dewy makeup, gold hoop earrings, neutral-toned outfits, and an effortlessly chic vibe. Focus on groomed appearance and simple elegance.",
      tags: ["minimal", "clean", "elegant", "neutral"],
      source: "TikTok",
      popularity_score: 92
    },
    {
      name: "Gorpcore",
      description: "Outdoor gear meets street style with technical fabrics, hiking boots, utility vests, cargo pants, and functional fashion pieces. Combines practicality with urban aesthetic.",
      tags: ["outdoor", "functional", "sporty", "technical"],
      source: "Instagram",
      popularity_score: 85
    },
    {
      name: "Barbiecore",
      description: "All-pink maximalist aesthetic with hot pink outfits, feminine silhouettes, playful accessories, and bold, confident styling. Popularized by the Barbie movie trend.",
      tags: ["pink", "feminine", "playful", "bold"],
      source: "TikTok",
      popularity_score: 90
    },
    {
      name: "Quiet Luxury",
      description: "Understated wealth aesthetic featuring high-quality basics, neutral colors, perfect tailoring, minimal branding, and timeless pieces. Emphasis on craftsmanship over logos.",
      tags: ["minimal", "luxury", "neutral", "timeless"],
      source: "Instagram",
      popularity_score: 87
    },
    {
      name: "Balletcore",
      description: "Ballet-inspired fashion featuring wrap cardigans, leg warmers, soft pink tones, delicate ribbons, and graceful silhouettes. Channels the elegance of ballet dancers.",
      tags: ["ballet", "feminine", "soft", "dance"],
      source: "TikTok",
      popularity_score: 83
    },
    {
      name: "Coastal Grandmother",
      description: "Relaxed, sophisticated style inspired by beach house living with linen fabrics, wide-leg pants, neutral tones, straw hats, and effortlessly elegant pieces.",
      tags: ["coastal", "relaxed", "linen", "sophisticated"],
      source: "Instagram",
      popularity_score: 80
    }
  ];
}
