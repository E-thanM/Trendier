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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { hashtag, maxVideos = 10, forceRefresh = false } = await req.json();
    
    if (!hashtag) {
      return new Response(
        JSON.stringify({ error: 'Hashtag is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanHashtag = hashtag.replace('#', '').toLowerCase();
    console.log(`Analyzing TikTok trends for hashtag: ${cleanHashtag}`);

    // Check if we have recent cached data (within 24 hours)
    if (!forceRefresh) {
      const { data: cachedVideos } = await supabaseClient
        .from('tiktok_videos')
        .select(`
          *,
          detected_items:tiktok_detected_items(*)
        `)
        .eq('hashtag', cleanHashtag)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('overall_trend_score', { ascending: false });

      if (cachedVideos && cachedVideos.length > 0) {
        console.log(`Using ${cachedVideos.length} cached videos from database`);
        
        const rankedAnalyses = cachedVideos.map((video: any) => ({
          videoId: video.video_id,
          videoUrl: video.video_url,
          author: video.author,
          description: video.description,
          detectedItems: video.detected_items.map((item: any) => ({
            name: item.item_name,
            category: item.category,
            confidence: item.confidence,
            trendScore: item.trend_score
          })),
          overallTrendScore: video.overall_trend_score,
          rank: video.rank,
          percentile: video.percentile,
          trendingItems: video.detected_items
            .filter((item: any) => item.matches_trend)
            .map((item: any) => item.matches_trend)
        }));

        return new Response(
          JSON.stringify({
            success: true,
            hashtag: cleanHashtag,
            totalVideos: rankedAnalyses.length,
            analyses: rankedAnalyses,
            cached: true,
            summary: {
              mostTrendyVideo: rankedAnalyses[0],
              averageTrendScore: Math.round(
                rankedAnalyses.reduce((sum: number, a: any) => sum + a.overallTrendScore, 0) / rankedAnalyses.length
              ),
              topItems: getTopItemsFromCache(rankedAnalyses, 5)
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`No cache found, scraping fresh data for: ${cleanHashtag}`);

    // Fetch trending items from database
    const { data: trends } = await supabaseClient
      .from('trends')
      .select('name, tags')
      .order('popularity_score', { ascending: false })
      .limit(20);

    const trendsList = trends?.map(t => `${t.name} (${t.tags?.join(', ')})`).join(', ') || 'No trends available';

    // Scrape TikTok videos with REAL thumbnails (unlimited, no Serper needed!)
    const serperApiKey = Deno.env.get('SERPER_API_KEY');
    const videos = await scrapeTikTokVideos(cleanHashtag, maxVideos, serperApiKey);
    console.log(`✅ Scraped ${videos.length} videos with real thumbnails for AI analysis`);

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No videos found for this hashtag' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Analyze ALL videos in parallel with batching for speed
    const startTime = Date.now();
    const batchSize = 5; // Analyze 5 videos at a time to avoid overwhelming the AI API
    const allAnalyses: AnalysisResult[] = [];
    
    console.log(`🚀 Starting parallel batch analysis of ${videos.length} videos (batches of ${batchSize})...`);
    
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      console.log(`📊 Analyzing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(videos.length / batchSize)} (${batch.length} videos)...`);
      
      const batchPromises = batch.map(video => analyzeVideo(video, trendsList, lovableApiKey));
      const batchResults = await Promise.all(batchPromises);
      
      // Filter out failed analyses
      const successfulAnalyses = batchResults.filter((result): result is AnalysisResult => result !== null);
      allAnalyses.push(...successfulAnalyses);
      
      console.log(`✅ Batch complete: ${successfulAnalyses.length}/${batch.length} successful`);
    }
    
    const analysisTime = Date.now() - startTime;
    console.log(`🎯 Analysis complete: ${allAnalyses.length}/${videos.length} videos analyzed in ${analysisTime}ms (${(analysisTime / videos.length).toFixed(0)}ms per video)`);

    if (allAnalyses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Failed to analyze videos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sort by trend score
    allAnalyses.sort((a: AnalysisResult, b: AnalysisResult) => b.overallTrendScore - a.overallTrendScore);

    // Calculate relative rankings
    const rankedAnalyses = allAnalyses.map((analysis: AnalysisResult, index: number) => ({
      ...analysis,
      rank: index + 1,
      percentile: Math.round(((allAnalyses.length - index) / allAnalyses.length) * 100)
    }));

    // Store in database for future use
    console.log('Storing results in database...');
    await storeAnalysisResults(supabaseClient, cleanHashtag, rankedAnalyses);

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

import { scrapeTikTokVideos } from './tiktok-scraper.ts';


async function analyzeVideo(video: TikTokVideo, trendsList: string, lovableApiKey: string): Promise<AnalysisResult | null> {
  try {
    console.log(`Analyzing video ${video.id} - Thumbnail: ${video.thumbnailUrl.substring(0, 60)}...`);
    
    const analysisPrompt = `CRITICAL: Analyze the ACTUAL IMAGE/THUMBNAIL to identify what clothing the person is wearing.

Video Details:
- URL: ${video.videoUrl}
- Author: @${video.author}
- Description: "${video.description}"

Your task:
1. LOOK AT THE IMAGE - identify all visible clothing items
2. Be specific about styles (e.g., "oversized denim jacket", "pleated mini skirt", "chunky platform sneakers")
3. Rate each item's trend score (0-100) based on current fashion trends
4. Match items against these trending pieces: ${trendsList}

Categories: tops, bottoms, shoes, accessories, outerwear, brand

Focus on VISUAL CONTENT in the thumbnail. What do you actually SEE the person wearing?`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: analysisPrompt },
            { type: 'image_url', image_url: { url: video.thumbnailUrl } }
          ]
        }],
        tools: [{
          type: "function",
          function: {
            name: "analyze_fashion_items",
            description: "Identify and rate fashion items",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      category: { type: "string" },
                      trendScore: { type: "number" },
                      matchesTrend: { type: "string" }
                    },
                    required: ["name", "category", "trendScore"]
                  }
                }
              },
              required: ["items"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_fashion_items" } }
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      return null;
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No analysis result for video:', video.id);
      return null;
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    const detectedItems: ClothingItem[] = analysis.items.map((item: any) => ({
      name: item.name,
      category: item.category,
      confidence: 100,
      trendScore: item.trendScore
    }));

    const overallTrendScore = detectedItems.length > 0
      ? Math.round(detectedItems.reduce((sum, item) => sum + item.trendScore, 0) / detectedItems.length)
      : 0;

    const trendingItems = analysis.items
      .filter((item: any) => item.matchesTrend)
      .map((item: any) => item.matchesTrend);

    return {
      videoId: video.id,
      videoUrl: video.videoUrl,
      author: video.author,
      description: video.description,
      detectedItems,
      overallTrendScore,
      trendingItems
    };
  } catch (error) {
    console.error(`Error analyzing video ${video.id}:`, error);
    return null;
  }
}

async function storeAnalysisResults(supabaseClient: any, hashtag: string, analyses: any[]) {
  try {
    // Update hashtag tracking
    await supabaseClient
      .from('tiktok_hashtags')
      .upsert({
        hashtag,
        last_scraped_at: new Date().toISOString(),
        video_count: analyses.length
      }, { onConflict: 'hashtag' });

    // Store videos
    for (const analysis of analyses) {
      const { data: videoData, error: videoError } = await supabaseClient
        .from('tiktok_videos')
        .upsert({
          video_id: analysis.videoId,
          hashtag,
          video_url: analysis.videoUrl,
          thumbnail_url: `https://picsum.photos/400/600?random=${analysis.videoId}`,
          description: analysis.description,
          author: analysis.author,
          overall_trend_score: analysis.overallTrendScore,
          rank: analysis.rank,
          percentile: analysis.percentile
        }, { onConflict: 'video_id' })
        .select()
        .single();

      if (videoError) {
        console.error('Error storing video:', videoError);
        continue;
      }

      // Store detected items
      const itemsToInsert = analysis.detectedItems.map((item: any) => ({
        video_id: videoData.id,
        item_name: item.name,
        category: item.category,
        trend_score: item.trendScore,
        confidence: item.confidence,
        matches_trend: analysis.trendingItems.find((t: string) => t.toLowerCase().includes(item.name.toLowerCase())) || null
      }));

      if (itemsToInsert.length > 0) {
        await supabaseClient
          .from('tiktok_detected_items')
          .delete()
          .eq('video_id', videoData.id);

        await supabaseClient
          .from('tiktok_detected_items')
          .insert(itemsToInsert);
      }
    }

    console.log('Successfully stored analysis results in database');
  } catch (error) {
    console.error('Error storing analysis results:', error);
  }
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
  
  return Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      occurrences: data.count,
      avgTrendScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, count);
}

function getTopItemsFromCache(analyses: any[], count: number) {
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
  
  return Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      occurrences: data.count,
      avgTrendScore: Math.round(data.totalScore / data.count)
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, count);
}
