import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HASHTAG_QUERY_MAP: Record<string, string> = {
  'fashion': 'fashion outfit ideas 2024',
  'ootd': 'OOTD outfit of the day fashion',
  'streetwear': 'streetwear outfit inspo',
  'style': 'style guide clothing fashion',
  'outfitinspo': 'outfit inspiration ideas fashion',
  'fashiontiktok': 'fashion haul trends lookbook',
  'mensfashion': 'mens fashion outfit style 2024',
  'womensfashion': 'womens fashion outfit style 2024',
  'casualwear': 'casual outfit ideas everyday fashion',
  'formalwear': 'formal outfit business professional attire',
  'athleisure': 'athleisure sporty fashion activewear outfit',
  'vintage': 'vintage fashion retro outfit thrift styling',
  'minimalist': 'minimalist fashion clean outfit aesthetic',
  'bohemian': 'bohemian boho fashion outfit style',
  'grunge': 'grunge fashion outfit alternative style',
  'preppy': 'preppy fashion outfit collegiate style',
  'edgy': 'edgy fashion outfit dark alternative style',
  'chic': 'chic fashion outfit elegant style',
  'trendy': 'trendy fashion outfit latest trends 2024',
  'summer': 'summer fashion outfit warm weather style',
  'winter': 'winter fashion outfit cold weather style',
  'spring': 'spring fashion outfit seasonal style',
  'fall': 'fall fashion outfit autumn style',
  'denim': 'denim outfit jeans fashion styling',
  'blazer': 'blazer outfit professional fashion styling',
  'dress': 'dress outfit fashion styling ideas',
  'sneakers': 'sneakers outfit fashion styling ideas',
  'accessories': 'fashion accessories styling outfit ideas',
  'layering': 'layering outfit fashion styling guide',
  'colorblock': 'color blocking outfit fashion styling'
};

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

async function analyzeVideoWithLovableAI(video: YouTubeVideo, lovableApiKey: string) {
  try {
    const response = await fetch(
      'https://ai.gateway.lovable.dev/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'user', 
              content: [
                {
                  type: 'text',
                  text: `Analyze this fashion video thumbnail and title:\n\nTitle: "${video.title}"\nChannel: "${video.channelTitle}"\n\nVISUAL ANALYSIS INSTRUCTIONS:\n1. Examine the THUMBNAIL IMAGE to identify actual clothing items visible in the frame\n2. Verify the person is wearing real outfits/clothing (not just fashion news, clickbait, or non-fashion content)\n3. Sexual Content Check: Reject if image shows revealing/sexual clothing, suggestive poses, or explicit content\n4. Extract 2-3 SPECIFIC clothing items you SEE in the thumbnail (e.g., "oversized blazer", "high-waisted jeans", "white sneakers")\n5. Score 60-95 based on visual trendiness:\n   - High (85-95): Current trending styles, unique combinations, viral aesthetics\n   - Medium (75-84): Popular everyday outfits, solid styling\n   - Low (60-74): Basic/dated outfits\n\nIMPORTANT: Base your analysis on WHAT YOU SEE in the thumbnail image. Only approve if the thumbnail clearly shows styled clothing/outfits being worn.\n\nReturn ONLY valid JSON: {"appropriate": boolean, "sexualContent": boolean, "items": [{"name": "string", "category": "string", "confidence": number, "trendScore": number}], "overallScore": number}`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: video.thumbnailUrl
                  }
                }
              ]
            }
          ],
          temperature: 0.1
        }),
      }
    );

    if (!response.ok) {
      return { appropriate: false, sexualContent: false, reason: 'API error', items: [], overallScore: 0 };
    }

    const result = await response.json();
    let text = result.choices?.[0]?.message?.content || '{}';
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const analysis = JSON.parse(text);
    
    // Validate structure
    if (typeof analysis.appropriate !== 'boolean' || !Array.isArray(analysis.items)) {
      return { appropriate: false, sexualContent: false, reason: 'Invalid format', items: [], overallScore: 0 };
    }
    
    console.log(`✓ ${video.title.slice(0, 30)}: score=${analysis.overallScore}, items=${analysis.items?.length || 0}`);
    return analysis;
  } catch (error) {
    console.error(`Analysis error for ${video.title.slice(0, 30)}:`, error);
    return { appropriate: false, sexualContent: false, reason: 'Parse error', items: [], overallScore: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { hashtag = 'fashion', maxVideos = 30 } = await req.json().catch(() => ({}));

    console.log(`🎬 Scraping YouTube fashion videos for: ${hashtag}`);

    // Select appropriate search query from mapping
    const query = HASHTAG_QUERY_MAP[hashtag.toLowerCase()] || `${hashtag} fashion outfit 2024`;
    console.log(`🔍 Using search query: "${query}"`);
    
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
          const analysis = await analyzeVideoWithLovableAI(video, lovableApiKey);
          
          // Strict filtering - reject inappropriate or sexual content
          if (!analysis || analysis.appropriate === false || analysis.sexualContent === true) {
            console.log(`🚫 Filtered out video: ${video.title.slice(0, 50)} - ${analysis?.reason || 'Inappropriate'}`);
            return;
          }

          // Require valid items and score
          if (!analysis.items || analysis.items.length === 0 || !analysis.overallScore) {
            console.log(`⚠️ Skipped video with incomplete analysis: ${video.title.slice(0, 50)}`);
            return;
          }

          const items = analysis.items;

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
          for (const item of items) {
            await supabase.from('tiktok_detected_items').insert({
              video_id: insertedVideo.id,
              item_name: item.name,
              category: item.category,
              confidence: item.confidence,
              trend_score: item.trendScore,
            });
          }

          stored++;
          console.log(`✅ Stored YouTube video: ${video.title.slice(0, 50)} with ${items.length} items (score: ${analysis.overallScore})`);
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
