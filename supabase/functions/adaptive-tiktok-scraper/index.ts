import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
];

// Known working fashion TikTok accounts
const FASHION_CREATORS = [
  'fashionnova', 'shein_official', 'zara', 'hm', 'asos', 'prettylittlething',
  'boohoo', 'fashioninspo', 'ootdfashion', 'styleinspo', 'outfitideas'
];

// Try to fetch videos from TikTok's mobile API
async function fetchFromMobileAPI(hashtag: string, maxResults: number = 20) {
  const videos: Array<{id: string, videoUrl: string, thumbnailUrl: string, description: string, author: string}> = [];
  
  try {
    console.log(`📱 Trying TikTok mobile API for #${hashtag}...`);
    
    // Try different TikTok API endpoints
    const endpoints = [
      `https://m.tiktok.com/api/challenge/item_list/?challengeName=${hashtag}&count=${maxResults}`,
      `https://m.tiktok.com/api/post/item_list/?count=${maxResults}&type=5`,
      `https://www.tiktok.com/api/challenge/item_list/?challengeName=${hashtag}&count=${maxResults}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            'Accept': 'application/json',
            'Referer': 'https://www.tiktok.com/',
          },
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Try to extract videos from various response structures
          const items = data.itemList || data.items || data.aweme_list || [];
          
          for (const item of items.slice(0, maxResults)) {
            try {
              const video = item.video || item;
              const author = item.author || { nickname: 'unknown', uniqueId: 'user' };
              const videoId = item.id || item.aweme_id || video.id;
              
              if (videoId) {
                videos.push({
                  id: videoId,
                  videoUrl: `https://www.tiktok.com/@${author.uniqueId}/video/${videoId}`,
                  thumbnailUrl: video.cover || video.dynamicCover || video.originCover || '',
                  description: item.desc || item.description || '',
                  author: author.nickname || author.uniqueId || 'unknown'
                });
              }
            } catch (e) {
              continue;
            }
          }
          
          if (videos.length > 0) {
            console.log(`✅ Mobile API found ${videos.length} videos`);
            return videos;
          }
        }
      } catch (e) {
        continue;
      }
    }
  } catch (e) {
    console.log(`Mobile API failed: ${e}`);
  }
  
  return videos;
}

// Scrape creator profiles for recent videos
async function scrapeCreatorVideos(maxVideos: number) {
  const videos: Array<{id: string, videoUrl: string, thumbnailUrl: string, description: string, author: string}> = [];
  
  console.log(`👤 Scraping ${FASHION_CREATORS.length} fashion creator profiles...`);
  
  for (const creator of FASHION_CREATORS) {
    if (videos.length >= maxVideos) break;
    
    try {
      const profileUrl = `https://www.tiktok.com/@${creator}`;
      const response = await fetch(profileUrl, {
        headers: {
          'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Extract video IDs from profile page
        const videoIdMatches = html.matchAll(/\/video\/(\d{19})/g);
        const videoIds = Array.from(videoIdMatches, m => m[1]).slice(0, 3);
        
        for (const videoId of videoIds) {
          if (videos.length >= maxVideos) break;
          
          try {
            const videoUrl = `https://www.tiktok.com/@${creator}/video/${videoId}`;
            const oembedResponse = await fetch(
              `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
              { 
                headers: { 'User-Agent': USER_AGENTS[0] },
                signal: AbortSignal.timeout(3000)
              }
            );
            
            if (oembedResponse.ok) {
              const oembed = await oembedResponse.json();
              if (oembed.thumbnail_url) {
                console.log(`✅ Found video from @${creator}: ${videoId}`);
                videos.push({
                  id: videoId,
                  videoUrl,
                  thumbnailUrl: oembed.thumbnail_url,
                  description: oembed.title || '',
                  author: oembed.author_name || creator,
                });
              }
            }
          } catch (e) {
            continue;
          }
          
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } catch (e) {
      console.log(`Failed to scrape @${creator}: ${e}`);
      continue;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return videos;
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

    console.log(`🔍 Multi-strategy TikTok discovery for #${hashtag}...`);

    let discoveredVideos: Array<{
      id: string;
      videoUrl: string;
      thumbnailUrl: string;
      description: string;
      author: string;
    }> = [];

    // Strategy 1: Try TikTok mobile API
    const mobileVideos = await fetchFromMobileAPI(hashtag, maxVideos);
    if (mobileVideos.length > 0) {
      discoveredVideos.push(...mobileVideos);
      console.log(`📱 Mobile API: ${mobileVideos.length} videos`);
    }

    // Strategy 2: Scrape fashion creator profiles
    if (discoveredVideos.length < maxVideos) {
      const creatorVideos = await scrapeCreatorVideos(maxVideos - discoveredVideos.length);
      discoveredVideos.push(...creatorVideos);
      console.log(`👤 Creator scraping: ${creatorVideos.length} videos`);
    }

    // Deduplicate by video ID
    const uniqueVideos = Array.from(
      new Map(discoveredVideos.map(v => [v.id, v])).values()
    ).slice(0, maxVideos);

    console.log(`✅ Discovered ${uniqueVideos.length} total videos`);

    if (uniqueVideos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No fashion videos discovered',
          storedVideos: 0,
          method: 'multi-strategy'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze and store
    const stored = await analyzeAndStoreVideos(supabase, hashtag, uniqueVideos, geminiApiKey);

    return new Response(
      JSON.stringify({ 
        success: true,
        hashtag,
        discoveredVideos: uniqueVideos.length,
        storedVideos: stored,
        method: 'multi-strategy'
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