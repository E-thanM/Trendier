import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FASHION_QUERIES = [
  'fashion outfit ideas 2024',
  'OOTD fashion style',
  'streetwear outfit inspo',
  'fashion haul trends',
  'outfit of the day fashion',
  'style guide clothing',
];

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  videoUrl: string;
}

async function searchYouTubeVideos(query: string, maxResults: number = 20): Promise<YouTubeVideo[]> {
  const videos: YouTubeVideo[] = [];
  
  try {
    console.log(`🔍 Searching YouTube for: "${query}"`);
    
    // Use YouTube's oembed and search through Serper or direct scraping
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      console.error(`YouTube search failed: ${response.status}`);
      return videos;
    }

    const html = await response.text();
    
    // Extract video data from YouTube's initial data
    const videoIdMatches = html.matchAll(/"videoId":"([^"]+)"/g);
    const videoIds = Array.from(new Set(Array.from(videoIdMatches, m => m[1]))).slice(0, maxResults);
    
    console.log(`📹 Found ${videoIds.length} video IDs`);

    // Get video details using oembed API
    for (const videoId of videoIds) {
      try {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
        
        const oembedResponse = await fetch(oembedUrl);
        
        if (oembedResponse.ok) {
          const data = await oembedResponse.json();
          
          videos.push({
            id: videoId,
            title: data.title || '',
            description: '',
            thumbnailUrl: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            channelTitle: data.author_name || '',
            videoUrl,
          });
          
          console.log(`✅ Added video: ${data.title?.slice(0, 50)}...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (e) {
        console.error(`Failed to fetch video ${videoId}:`, e);
        continue;
      }
    }
    
  } catch (error) {
    console.error('YouTube search error:', error);
  }
  
  return videos;
}

async function analyzeVideoWithGemini(video: YouTubeVideo, geminiApiKey: string) {
  const prompt = `Analyze this fashion YouTube video:
Title: "${video.title}"
Channel: "${video.channelTitle}"
Thumbnail: ${video.thumbnailUrl}

Task 1: Is this appropriate fashion/outfit content? (true/false)
Task 2: Extract 2-5 specific clothing items or fashion elements visible or mentioned
Task 3: Rate overall trend score (60-100)

Return ONLY valid JSON:
{
  "appropriate": true,
  "items": [{"name": "oversized blazer", "category": "outerwear", "confidence": 0.9, "trendScore": 85}],
  "overallScore": 82
}`;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
        }),
      }
    );

    const result = await response.json();
    let analysisText = result.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    if (analysisText.includes('```')) {
      analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    return JSON.parse(analysisText);
  } catch (error) {
    console.error('Gemini analysis error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { hashtag = 'fashion', maxVideos = 30 } = await req.json().catch(() => ({}));

    console.log(`🎬 Scraping YouTube fashion videos for: ${hashtag}`);

    // Select appropriate search query
    const query = FASHION_QUERIES.find(q => q.includes(hashtag.toLowerCase())) || `${hashtag} fashion outfit`;
    
    const videos = await searchYouTubeVideos(query, maxVideos);
    
    console.log(`📹 Found ${videos.length} YouTube videos`);

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No YouTube videos found',
          storedVideos: 0,
          source: 'youtube'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let stored = 0;
    const batchSize = 5;
    
    for (let i = 0; i < videos.length; i += batchSize) {
      const batch = videos.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (video) => {
        try {
          const analysis = await analyzeVideoWithGemini(video, geminiApiKey);
          
          if (!analysis || !analysis.appropriate) {
            console.log(`⚠️ Filtered video: ${video.title.slice(0, 50)}`);
            return;
          }

          // Store in tiktok_videos table (will rename later to video_trends)
          const { data: insertedVideo, error } = await supabase
            .from('tiktok_videos')
            .insert({
              video_id: `yt_${video.id}`,
              video_url: video.videoUrl,
              thumbnail_url: video.thumbnailUrl,
              description: video.title,
              author: video.channelTitle,
              hashtag,
              overall_trend_score: analysis.overallScore || 75,
              rank: 1,
              percentile: 85,
            })
            .select()
            .single();

          if (error) {
            if (error.code === '23505') {
              console.log(`Duplicate video ${video.id}, skipping`);
              return;
            }
            throw error;
          }

          // Store detected items
          for (const item of analysis.items || []) {
            await supabase.from('tiktok_detected_items').insert({
              video_id: insertedVideo.id,
              item_name: item.name,
              category: item.category,
              confidence: item.confidence,
              trend_score: item.trendScore,
            });
          }

          stored++;
          console.log(`✅ Stored YouTube video: ${video.title.slice(0, 50)} with ${analysis.items?.length || 0} items`);
        } catch (e) {
          console.error(`Error processing video ${video.id}:`, e);
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 Successfully stored ${stored} YouTube videos`);

    return new Response(
      JSON.stringify({ 
        success: true,
        hashtag,
        discoveredVideos: videos.length,
        storedVideos: stored,
        source: 'youtube'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('YouTube scraper error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        storedVideos: 0,
        source: 'youtube'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
