import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!;
    const serperApiKey = Deno.env.get('SERPER_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { hashtag = 'fashion', maxVideos = 20 } = await req.json().catch(() => ({}));

    console.log(`🔍 Adaptive Google search for TikTok #${hashtag} videos...`);

    // Use Google to find TikTok videos (bypasses TikTok's anti-scraping)
    const searchResponse = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: `site:tiktok.com/video ${hashtag} fashion outfit`,
        num: maxVideos * 3,
        gl: 'us',
        hl: 'en',
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const searchResults = await searchResponse.json();
    const videoUrls = (searchResults.organic || [])
      .map((r: any) => r.link)
      .filter((link: string) => link && link.includes('tiktok.com') && link.includes('/video/'));

    console.log(`📦 Found ${videoUrls.length} video URLs`);

    if (videoUrls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No videos found', storedVideos: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and fetch video data using oembed (unlimited API)
    const videos = await Promise.all(
      videoUrls.slice(0, maxVideos).map(async (url: string) => {
        try {
          const match = url.match(/\/@([^/]+)\/video\/(\d+)/);
          if (!match) return null;

          const [, author, videoId] = match;
          
          const oembedResponse = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
            { 
              headers: { 'User-Agent': USER_AGENTS[0] },
              signal: AbortSignal.timeout(5000)
            }
          );
          
          if (oembedResponse.ok) {
            const oembed = await oembedResponse.json();
            return {
              id: videoId,
              videoUrl: url,
              thumbnailUrl: oembed.thumbnail_url || '',
              description: oembed.title || '',
              author: oembed.author_name || author,
            };
          }
        } catch (e) {
          console.log(`Skipped video: ${e}`);
        }
        return null;
      })
    );

    const validVideos = videos.filter((v): v is NonNullable<typeof v> => v !== null && v.thumbnailUrl !== '');
    console.log(`✅ Validated ${validVideos.length} videos`);

    // Analyze and store
    const stored = await analyzeAndStoreVideos(supabase, hashtag, validVideos, geminiApiKey);

    return new Response(
      JSON.stringify({ 
        success: true,
        hashtag,
        scrapedVideos: videoUrls.length,
        validVideos: validVideos.length,
        storedVideos: stored,
        method: 'google-search-adaptive'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Adaptive scraper error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        storedVideos: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzeAndStoreVideos(supabase: any, hashtag: string, videos: any[], geminiApiKey: string): Promise<number> {
  let stored = 0;
  const batchSize = 5;
  
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    
    await Promise.all(batch.map(async (video) => {
      try {
        const analysisPrompt = `Analyze this fashion/outfit TikTok video:
Title: "${video.description}"
Author: @${video.author}

Task 1: Is this appropriate fashion content? (true/false)
Task 2: Extract 2-4 specific clothing items visible
Task 3: Rate overall trend score (60-100)

Return ONLY valid JSON:
{
  "appropriate": true,
  "items": [{"name": "black leather jacket", "category": "outerwear", "confidence": 0.9, "trendScore": 88}],
  "overallScore": 85
}`;

        const analysisResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: analysisPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
          })
        });

        const analysisResult = await analysisResponse.json();
        let analysisText = analysisResult.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        
        if (analysisText.includes('```')) {
          analysisText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        }
        
        const analysis = JSON.parse(analysisText);

        if (!analysis.appropriate) {
          console.log(`⚠️ Filtered inappropriate video: ${video.id}`);
          return;
        }

        // Store video
        const { data: insertedVideo, error } = await supabase
          .from('tiktok_videos')
          .insert({
            video_id: video.id,
            video_url: video.videoUrl,
            thumbnail_url: video.thumbnailUrl,
            description: video.description,
            author: video.author,
            hashtag,
            overall_trend_score: analysis.overallScore || 75,
            rank: 1,
            percentile: 85
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

        // Store items
        for (const item of analysis.items || []) {
          await supabase.from('tiktok_detected_items').insert({
            video_id: insertedVideo.id,
            item_name: item.name,
            category: item.category,
            confidence: item.confidence,
            trend_score: item.trendScore
          });
        }

        stored++;
        console.log(`✅ Stored video ${video.id} with ${analysis.items?.length || 0} items`);
      } catch (e) {
        console.error(`Error with video ${video.id}:`, e);
      }
    }));
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return stored;
}