import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateSearchTerms, generateDynamicCategories } from "./fashion-categories.ts";
import { analyzeVideoContent, aggregateTrendData } from "./video-analyzer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrendWithHistory {
  name: string;
  description: string;
  tags: string[];
  source: string;
  popularity_score: number;
  history?: { date: string; score: number }[];
}

interface TikTokVideo {
  id: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  authorUsername: string;
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  hashtags: string[];
  musicName?: string;
}

/**
 * Discovers trending fashion searches using Serper API
 * Used sparingly to guide TikTok video analysis
 */
async function discoverTrendingFashionSearches(): Promise<string[]> {
  const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
  
  if (!SERPER_API_KEY) {
    console.log('No SERPER_API_KEY found, skipping Google trends discovery');
    return [];
  }

  try {
    console.log('Discovering trending fashion searches with Serper API...');
    
    const trendingSearches: string[] = [];
    
    // Key fashion queries to check what's trending
    const baseQueries = [
      'fashion trends 2025',
      'trending fashion style',
      'viral fashion tiktok'
    ];
    
    for (const query of baseQueries) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Extract trending terms from search results
        if (data.organic) {
          for (const result of data.organic.slice(0, 3)) {
            const title = result.title?.toLowerCase() || '';
            const snippet = result.snippet?.toLowerCase() || '';
            
            // Extract fashion-related keywords
            const text = `${title} ${snippet}`;
            const fashionKeywords = text.match(/\b(?:style|trend|fashion|outfit|aesthetic|wear|clothing|look)\w*\b/gi);
            
            if (fashionKeywords) {
              trendingSearches.push(...fashionKeywords.slice(0, 2));
            }
          }
        }
        
        // Extract related searches
        if (data.relatedSearches) {
          for (const related of data.relatedSearches.slice(0, 3)) {
            trendingSearches.push(related.query);
          }
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Deduplicate and return
    const uniqueSearches = [...new Set(trendingSearches)];
    console.log(`Discovered ${uniqueSearches.length} trending fashion searches from Google`);
    
    return uniqueSearches.slice(0, 15); // Return top 15
    
  } catch (error) {
    console.error('Serper API error:', error);
    return [];
  }
}

/**
 * Scrapes TikTok videos and analyzes actual visual content using AI
 * This is much more comprehensive than just hashtag scraping
 */
async function scrapeFashionVideosFromTikTok(lovableApiKey: string): Promise<any[]> {
  try {
    console.log('Starting comprehensive TikTok fashion video analysis...');
    
    // First, discover what's trending on Google (used sparingly)
    const googleTrends = await discoverTrendingFashionSearches();
    
    // Combine generated terms with Google trends for maximum relevance
    let searchTerms = generateSearchTerms();
    
    if (googleTrends.length > 0) {
      console.log(`Prioritizing ${googleTrends.length} Google-discovered trends`);
      searchTerms = [...googleTrends, ...searchTerms];
    }
    const allVideos: TikTokVideo[] = [];
    const videoAnalyses: any[] = [];
    
    // TikTok API headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'application/json',
    };
    
    // Fetch videos from multiple trending fashion search terms
    console.log(`Analyzing ${searchTerms.length} fashion categories...`);
    
    for (let i = 0; i < Math.min(searchTerms.length, 50); i++) {
      const searchTerm = searchTerms[i];
      
      try {
        // TikTok search API endpoint
        const searchUrl = `https://www.tiktok.com/api/search/general/full/?keyword=${encodeURIComponent(searchTerm)}&offset=0&count=30`;
        
        console.log(`Fetching videos for: ${searchTerm}`);
        const response = await fetch(searchUrl, { headers });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.data) {
            const videos = data.data.slice(0, 10); // Get top 10 videos per search
            
            for (const videoData of videos) {
              try {
                // Extract video information
                const video: TikTokVideo = {
                  id: videoData.id || `video_${Date.now()}_${Math.random()}`,
                  description: videoData.desc || videoData.description || '',
                  videoUrl: videoData.video?.playAddr || '',
                  thumbnailUrl: videoData.video?.cover || videoData.video?.dynamicCover || '',
                  authorUsername: videoData.author?.uniqueId || 'unknown',
                  stats: {
                    views: videoData.stats?.playCount || 0,
                    likes: videoData.stats?.diggCount || 0,
                    comments: videoData.stats?.commentCount || 0,
                    shares: videoData.stats?.shareCount || 0,
                  },
                  hashtags: videoData.textExtra?.map((tag: any) => tag.hashtagName).filter(Boolean) || [],
                  musicName: videoData.music?.title || undefined,
                };
                
                allVideos.push(video);
                
                // Analyze video content using AI vision
                if (video.thumbnailUrl) {
                  console.log(`Analyzing video content with AI vision: ${video.id}`);
                  
                  const analysis = await analyzeVideoContent(
                    video.videoUrl,
                    video.thumbnailUrl,
                    video.description,
                    lovableApiKey
                  );
                  
                  videoAnalyses.push({
                    videoId: video.id,
                    searchTerm,
                    analysis,
                    stats: video.stats,
                    hashtags: video.hashtags,
                  });
                  
                  console.log(`Analysis complete - Found: ${analysis.clothing_items.length} items, ${analysis.brands_detected.length} brands`);
                }
                
              } catch (videoError) {
                console.error(`Error processing video:`, videoError);
              }
            }
          }
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (searchError) {
        console.error(`Error searching ${searchTerm}:`, searchError);
      }
    }
    
    console.log(`Analyzed ${videoAnalyses.length} videos with AI vision`);
    
    // Aggregate trends from video analyses
    const aggregatedTrends = aggregateTrendData(
      videoAnalyses.map(v => v.analysis)
    );
    
    console.log('Aggregated fashion trends:', aggregatedTrends);
    
    // Create comprehensive trend objects
    const trends: any[] = [];
    
    // Top clothing items as trends
    for (const item of aggregatedTrends.top_items) {
      const relatedVideos = videoAnalyses.filter(v => 
        v.analysis.clothing_items.some((i: string) => i.toLowerCase().includes(item.toLowerCase()))
      );
      
      const totalViews = relatedVideos.reduce((sum, v) => sum + v.stats.views, 0);
      
      trends.push({
        name: item,
        description: `Trending clothing item: ${item}`,
        tags: ['clothing', item.toLowerCase(), 'fashion'],
        source: 'tiktok_video_analysis',
        popularity_score: totalViews,
        videoCount: relatedVideos.length,
      });
    }
    
    // Trending brands as trends
    for (const brand of aggregatedTrends.trending_brands) {
      const relatedVideos = videoAnalyses.filter(v => 
        v.analysis.brands_detected.some((b: string) => b.toLowerCase() === brand.toLowerCase())
      );
      
      const totalViews = relatedVideos.reduce((sum, v) => sum + v.stats.views, 0);
      
      trends.push({
        name: brand,
        description: `Trending brand: ${brand}`,
        tags: ['brand', brand.toLowerCase(), 'fashion'],
        source: 'tiktok_video_analysis',
        popularity_score: totalViews,
        videoCount: relatedVideos.length,
      });
    }
    
    // Style aesthetics as trends
    for (const style of aggregatedTrends.emerging_styles) {
      const relatedVideos = videoAnalyses.filter(v => 
        v.analysis.style.toLowerCase().includes(style.toLowerCase())
      );
      
      const totalViews = relatedVideos.reduce((sum, v) => sum + v.stats.views, 0);
      
      trends.push({
        name: style,
        description: `Trending style: ${style}`,
        tags: ['style', style.toLowerCase(), 'aesthetic'],
        source: 'tiktok_video_analysis',
        popularity_score: totalViews,
        videoCount: relatedVideos.length,
      });
    }
    
    // Color trends
    for (const color of aggregatedTrends.popular_colors) {
      const relatedVideos = videoAnalyses.filter(v => 
        v.analysis.colors.some((c: string) => c.toLowerCase() === color.toLowerCase())
      );
      
      const totalViews = relatedVideos.reduce((sum, v) => sum + v.stats.views, 0);
      
      trends.push({
        name: color,
        description: `Trending color: ${color}`,
        tags: ['color', color.toLowerCase(), 'fashion'],
        source: 'tiktok_video_analysis',
        popularity_score: totalViews,
        videoCount: relatedVideos.length,
      });
    }
    
    console.log(`Created ${trends.length} comprehensive trends from video analysis`);
    return trends;
    
  } catch (error) {
    console.error('TikTok video analysis error:', error);
    throw error;
  }
}


async function enhanceTrendsWithAI(trends: any[]): Promise<TrendWithHistory[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('No LOVABLE_API_KEY found, using basic descriptions');
    return trends.map(trend => ({
      ...trend,
      source: 'TikTok Fashion Data'
    }));
  }

  console.log('Enhancing trends with AI fashion analysis...');
  
  const enhancedTrends = [];
  
  for (const trend of trends) {
    try {
      const prompt = `Analyze this fashion trend: "${trend.name}"

Current basic description: ${trend.description}

Provide a detailed, fashion-expert analysis covering:
1. Key clothing items and pieces that define this trend (specific items, cuts, silhouettes)
2. Common brands or design aesthetics associated with it
3. How to style this trend (layering, combinations, accessories)
4. Color palettes and fabrics typically used
5. Celebrity or influencer associations
6. Where this trend is most popular (runway, street style, social media)
7. Styling tips and how to incorporate it into everyday wear

Make it detailed, specific, and actionable for someone wanting to adopt this style. Focus on FASHION details, not just social media popularity.`;

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'You are a fashion expert analyst. Provide detailed, specific fashion insights about trends, clothing items, styling, and brands. Focus on actionable fashion advice.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 500
        }),
      });

      if (response.ok) {
        const aiData = await response.json();
        const enhancedDescription = aiData.choices?.[0]?.message?.content || trend.description;
        
        enhancedTrends.push({
          ...trend,
          description: enhancedDescription,
          source: 'AI-Enhanced Fashion Analysis'
        });
        
        console.log(`Enhanced trend: ${trend.name}`);
      } else {
        console.error(`Failed to enhance trend ${trend.name}: ${response.status}`);
        enhancedTrends.push({
          ...trend,
          source: 'TikTok Fashion Data'
        });
      }
      
      // Small delay between AI calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error enhancing trend ${trend.name}:`, error);
      enhancedTrends.push({
        ...trend,
        source: 'TikTok Fashion Data'
      });
    }
  }
  
  return enhancedTrends;
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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      console.warn('No LOVABLE_API_KEY found, using default trends without AI enhancement');
      trendingStyles = getDefaultTrends();
    } else {
      try {
        console.log('Analyzing fashion videos from TikTok with AI vision...');
        // New comprehensive video analysis that includes AI vision
        trendingStyles = await scrapeFashionVideosFromTikTok(LOVABLE_API_KEY);
        
        // Further enhance top trends with detailed AI analysis
        if (trendingStyles.length > 0) {
          const topTrends = trendingStyles
            .sort((a, b) => b.popularity_score - a.popularity_score)
            .slice(0, 20); // Top 20 trends only
            
          trendingStyles = await enhanceTrendsWithAI(topTrends);
        }
        
        console.log(`Analyzed and enhanced ${trendingStyles.length} fashion trends`);
      } catch (tiktokError) {
        console.error('TikTok video analysis failed, falling back to default trends:', tiktokError);
        const defaultTrends = getDefaultTrends();
        trendingStyles = LOVABLE_API_KEY ? await enhanceTrendsWithAI(defaultTrends) : defaultTrends;
      }
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
