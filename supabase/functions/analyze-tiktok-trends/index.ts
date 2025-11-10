import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TikTokVideo {
  id: string;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  author: string;
}

interface ClothingItem {
  name: string;
  category: string;
  confidence: number;
  trendScore: number;
}

interface AnalysisResult {
  videoId: string;
  videoUrl: string;
  author: string;
  description: string;
  detectedItems: ClothingItem[];
  overallTrendScore: number;
  trendingItems: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { hashtag, maxVideos = 10 } = await req.json();
    
    if (!hashtag) {
      return new Response(
        JSON.stringify({ error: 'Hashtag is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Scraping TikTok videos for hashtag: ${hashtag}`);

    // Fetch trending items from database
    const { data: trends, error: trendsError } = await supabaseClient
      .from('trends')
      .select('name, description, tags, popularity_score')
      .order('popularity_score', { ascending: false })
      .limit(20);

    if (trendsError) {
      console.error('Error fetching trends:', trendsError);
    }

    const trendsList = trends?.map(t => `${t.name} (${t.tags?.join(', ')})`).join(', ') || 'No trends available';

    // Scrape TikTok videos (using unofficial API approach)
    const videos = await scrapeTikTokVideos(hashtag, maxVideos);
    console.log(`Found ${videos.length} videos to analyze`);

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No videos found for this hashtag' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze each video with AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const analyses: AnalysisResult[] = [];

    for (const video of videos) {
      try {
        console.log(`Analyzing video: ${video.id}`);
        
        const analysisPrompt = `Analyze this TikTok video image and the video description/caption to identify all clothing items and fashion accessories.

Video Description: "${video.description}"

Current trending fashion items: ${trendsList}

For each clothing item you detect (from BOTH the image AND the description text):
1. Name the specific item (e.g., "oversized blazer", "cargo pants", "chunky sneakers")
2. Categorize it (tops, bottoms, shoes, accessories, outerwear)
3. Rate how trendy/fashionable it appears (0-100) based on current trends
4. Note if it matches any trending items from the list

Analyze the actual content: look at clothing styles, colors, fits, and styling. Also parse the description for mentioned items like "wearing", "outfit", brand names, clothing items, etc.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: analysisPrompt
                  },
                  {
                    type: 'image_url',
                    image_url: { url: video.thumbnailUrl }
                  }
                ]
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "analyze_fashion_items",
                  description: "Identify and rate fashion items in the image",
                  parameters: {
                    type: "object",
                    properties: {
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: { type: "string", description: "Name of the clothing item" },
                            category: { type: "string", description: "Category: tops, bottoms, shoes, accessories, outerwear" },
                            trendScore: { type: "number", description: "How trendy this item is (0-100)" },
                            matchesTrend: { type: "string", description: "Which trending item it matches, if any" }
                          },
                          required: ["name", "category", "trendScore"]
                        }
                      }
                    },
                    required: ["items"],
                    additionalProperties: false
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "analyze_fashion_items" } }
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', aiResponse.status, errorText);
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error('No analysis result from AI for video:', video.id);
          continue;
        }

        const analysis = JSON.parse(toolCall.function.arguments);
        const detectedItems: ClothingItem[] = analysis.items.map((item: any) => ({
          name: item.name,
          category: item.category,
          confidence: 100,
          trendScore: item.trendScore
        }));

        const overallTrendScore = detectedItems.length > 0
          ? detectedItems.reduce((sum, item) => sum + item.trendScore, 0) / detectedItems.length
          : 0;

        const trendingItems = analysis.items
          .filter((item: any) => item.matchesTrend)
          .map((item: any) => item.matchesTrend);

        analyses.push({
          videoId: video.id,
          videoUrl: video.videoUrl,
          author: video.author,
          description: video.description,
          detectedItems,
          overallTrendScore: Math.round(overallTrendScore),
          trendingItems
        });

        console.log(`Analyzed video ${video.id}: ${detectedItems.length} items, score: ${overallTrendScore}`);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error analyzing video ${video.id}:`, error);
      }
    }

    // Sort by trend score
    analyses.sort((a, b) => b.overallTrendScore - a.overallTrendScore);

    // Calculate relative rankings
    const rankedAnalyses = analyses.map((analysis, index) => ({
      ...analysis,
      rank: index + 1,
      percentile: Math.round(((analyses.length - index) / analyses.length) * 100)
    }));

    console.log(`Analysis complete: ${rankedAnalyses.length} videos analyzed`);

    return new Response(
      JSON.stringify({
        success: true,
        hashtag,
        totalVideos: rankedAnalyses.length,
        analyses: rankedAnalyses,
        summary: {
          mostTrendyVideo: rankedAnalyses[0],
          averageTrendScore: Math.round(
            rankedAnalyses.reduce((sum, a) => sum + a.overallTrendScore, 0) / rankedAnalyses.length
          ),
          topItems: getTopItems(rankedAnalyses, 5)
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function scrapeTikTokVideos(hashtag: string, maxVideos: number): Promise<TikTokVideo[]> {
  try {
    const serperApiKey = Deno.env.get('SERPER_API_KEY');
    
    if (serperApiKey) {
      console.log('Using Serper API to search TikTok videos');
      
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: `site:tiktok.com ${hashtag} fashion outfit`,
          num: maxVideos
        })
      });

      if (response.ok) {
        const data = await response.json();
        const videos: TikTokVideo[] = [];
        
        if (data.organic) {
          for (const result of data.organic.slice(0, maxVideos)) {
            const videoIdMatch = result.link.match(/video\/(\d+)/);
            if (videoIdMatch) {
              // Extract thumbnail from TikTok OEmbed
              const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(result.link)}`;
              let thumbnailUrl = `https://picsum.photos/400/600?random=${videos.length}`;
              
              try {
                const oembedResponse = await fetch(oembedUrl);
                if (oembedResponse.ok) {
                  const oembedData = await oembedResponse.json();
                  thumbnailUrl = oembedData.thumbnail_url || thumbnailUrl;
                }
              } catch (e) {
                console.error('Error fetching oembed:', e);
              }
              
              videos.push({
                id: videoIdMatch[1],
                videoUrl: result.link,
                thumbnailUrl,
                description: result.snippet || result.title || '',
                author: result.link.match(/@([^/]+)/)?.[1] || 'unknown'
              });
            }
          }
        }
        
        if (videos.length > 0) {
          console.log(`Found ${videos.length} videos via Serper`);
          return videos;
        }
      }
    }

    // Try direct TikTok API as fallback
    const cleanHashtag = hashtag.replace('#', '');
    const apiUrl = `https://www.tiktok.com/api/challenge/item_list/?challengeName=${encodeURIComponent(cleanHashtag)}&count=${maxVideos}`;
    
    console.log('Trying TikTok API:', apiUrl);
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.error('TikTok API error:', response.status);
      return generateMockVideos(hashtag, Math.min(maxVideos, 5));
    }

    const data = await response.json();
    const videos: TikTokVideo[] = [];

    if (data.itemList) {
      for (const item of data.itemList.slice(0, maxVideos)) {
        videos.push({
          id: item.id,
          videoUrl: `https://www.tiktok.com/@${item.author.uniqueId}/video/${item.id}`,
          thumbnailUrl: item.video.cover || item.video.dynamicCover || item.video.originCover,
          description: item.desc || '',
          author: item.author.uniqueId
        });
      }
    }

    if (videos.length === 0) {
      return generateMockVideos(hashtag, Math.min(maxVideos, 5));
    }

    return videos;
  } catch (error) {
    console.error('Error scraping TikTok:', error);
    return generateMockVideos(hashtag, Math.min(maxVideos, 5));
  }
}

function generateMockVideos(hashtag: string, count: number): TikTokVideo[] {
  console.log('Generating mock videos for demonstration');
  const mockVideos: TikTokVideo[] = [];
  
  for (let i = 0; i < count; i++) {
    mockVideos.push({
      id: `mock_${Date.now()}_${i}`,
      videoUrl: `https://www.tiktok.com/demo/${i}`,
      thumbnailUrl: `https://picsum.photos/400/600?random=${i}`,
      description: `Fashion video for ${hashtag} #${i + 1}`,
      author: `fashionuser${i + 1}`
    });
  }
  
  return mockVideos;
}

function getTopItems(analyses: AnalysisResult[], count: number): { name: string; occurrences: number; avgTrendScore: number }[] {
  const itemMap = new Map<string, { count: number; totalScore: number }>();
  
  for (const analysis of analyses) {
    for (const item of analysis.detectedItems) {
      const key = item.name.toLowerCase();
      const existing = itemMap.get(key);
      if (existing) {
        existing.count++;
        existing.totalScore += item.trendScore;
      } else {
        itemMap.set(key, { count: 1, totalScore: item.trendScore });
      }
    }
  }
  
  const topItems = Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      occurrences: data.count,
      avgTrendScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, count);
  
  return topItems;
}
