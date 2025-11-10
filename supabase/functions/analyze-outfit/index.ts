import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const requestSchema = z.object({
  imageUrl: z.string()
    .url('Invalid URL format')
    .max(2000, 'URL too long')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'https:' && 
                 parsed.hostname.includes('.supabase.co') &&
                 parsed.pathname.includes('/storage/v1/object/public/outfits/');
        } catch {
          return false;
        }
      },
      'Only images from Supabase storage are allowed'
    ),
  targetStyle: z.string()
    .trim()
    .min(1, 'Target style is required')
    .max(200, 'Target style must be 200 characters or less')
    .regex(
      /^[a-zA-Z0-9\s,.-]+$/,
      'Only letters, numbers, spaces, commas, periods, and hyphens are allowed'
    )
});

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

    // Extract JWT token from header
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create client with service role key
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user by passing the JWT token directly
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Request from authenticated user: ${user.id}`);

    const body = await req.json();
    const validation = requestSchema.safeParse(body);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          details: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { imageUrl, targetStyle } = validation.data;

    // Validate image format - Gemini doesn't support AVIF
    const imageExtension = imageUrl.split('.').pop()?.toLowerCase();
    const supportedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    if (!imageExtension || !supportedFormats.includes(imageExtension)) {
      return new Response(
        JSON.stringify({ 
          error: `Unsupported image format: ${imageExtension}. Please use JPG, PNG, WEBP, or GIF.`
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log('Fetching current trends...');
    
    // Fetch current trends using the authenticated client
    const { data: trends, error: trendsError } = await supabaseClient
      .from('trends')
      .select('name, description, tags, popularity_score')
      .order('popularity_score', { ascending: false })
      .limit(10);

    if (trendsError) {
      console.error('Error fetching trends:', trendsError);
      throw trendsError;
    }

    const trendsContext = trends?.map(t => 
      `${t.name} (${t.popularity_score}/100): ${t.description} - Tags: ${t.tags?.join(', ')}`
    ).join('\n') || 'No trends available';

    console.log('Analyzing outfit with AI to extract hashtags...');

    // Step 1: Extract fashion elements as general search terms (not specific hashtags)
    const extractionPrompt = `Analyze this outfit image and extract BROAD fashion search terms that would yield the most search results on Google.

Focus on GENERAL categories, not specific hashtags:
- Clothing items (e.g., "blazer", "jeans", "sneakers" - NOT specific styles)
- Colors with item (e.g., "grey blazer", "red clothing", "black shoes")
- Basic styles (e.g., "streetwear", "casual outfit", "formal wear")
- General patterns (e.g., "striped shirt", "leather jacket")

Rules:
1. Use 2-3 word phrases maximum
2. Be BROAD not specific (e.g., "blazer" not "oversized cropped blazer")
3. Include color + item combinations
4. Avoid brand names unless extremely visible
5. Focus on what would get most Google search volume

Return 5-8 general search terms that would work well in Google Search.`;

    // Fetch image as base64
    const imageResponse1 = await fetch(imageUrl);
    const imageBuffer1 = await imageResponse1.arrayBuffer();
    const base64Image1 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer1)));

    const hashtagResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: extractionPrompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image1
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!hashtagResponse.ok) {
      const errorText = await hashtagResponse.text();
      console.error('Gemini API error for search terms:', hashtagResponse.status, errorText);
      throw new Error(`Failed to extract search terms: ${hashtagResponse.status} - ${errorText}`);
    }

    const hashtagData = await hashtagResponse.json();
    const searchTerms = JSON.parse(hashtagData.candidates?.[0]?.content?.parts?.[0]?.text || '{"searchTerms":[]}').searchTerms;
    
    console.log(`Extracted ${searchTerms.length} search terms:`, searchTerms);

    // Step 2: Use Gemini to estimate trend popularity (saves Serper API calls)
    // Fetch recent TikTok trend data from database
    console.log('Fetching TikTok trend data...');
    const { data: tiktokItems, error: tiktokError } = await supabaseClient
      .from('tiktok_detected_items')
      .select(`
        item_name,
        category,
        trend_score,
        video:tiktok_videos(
          video_id,
          video_url,
          author,
          overall_trend_score,
          hashtag
        )
      `)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('trend_score', { ascending: false })
      .limit(50);

    if (tiktokError) {
      console.error('Error fetching TikTok data:', tiktokError);
    }

    const tiktokItemNames = tiktokItems?.map((item: any) => item.item_name.toLowerCase()) || [];
    console.log(`Found ${tiktokItemNames.length} trending items from TikTok`);

    console.log('Estimating trend popularity with Gemini...');
    
    const trendEstimationPrompt = `Based on your knowledge of current fashion trends (as of your training data), estimate the popularity and relevance of these fashion search terms on a scale of 0-100:

Search terms: ${searchTerms.join(', ')}

Trending on TikTok: ${tiktokItemNames.slice(0, 10).join(', ')}

For each term, provide:
1. Popularity score (0-100) - how trending is this term
2. Brief context (why it's popular/not popular)
3. Related trends

Consider TikTok trends, Instagram fashion trends, runway shows, and street style.`;

    const estimationResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${trendEstimationPrompt}\n\nReturn a JSON object with this structure:\n{\n  "estimates": [\n    {\n      "searchTerm": "term",\n      "popularityScore": 0-100,\n      "context": "explanation",\n      "relatedTrends": ["trend1", "trend2"]\n    }\n  ]\n}` }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      }),
    });

    const estimationData = await estimationResponse.json();
    const trendEstimates = JSON.parse(estimationData.candidates?.[0]?.content?.parts?.[0]?.text || '{"estimates":[]}').estimates;

    console.log('Trend estimates:', trendEstimates);

    // Step 3: Query Google Trends through Serper, then verify top trend
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    const googleTrendsData: any[] = [];
    let verifiedTopTrend = null;

    if (SERPER_API_KEY && searchTerms.length > 0) {
      console.log('Querying Google Trends for search terms...');
      
      // For each search term, query Google Trends to get trending information
      for (const term of searchTerms) {
        try {
          const trendsQuery = `${term} fashion trends site:trends.google.com`;
          console.log(`Searching Google Trends for: ${term}`);
          
          const trendsResponse = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              q: trendsQuery,
              num: 5  // Get top 5 results from Google Trends
            }),
          });

          if (trendsResponse.ok) {
            const trendsData = await trendsResponse.json();
            const trendingResults = trendsData.organic?.slice(0, 3) || [];
            
            googleTrendsData.push({
              searchTerm: term,
              trendsUrl: trendingResults[0]?.link || null,
              trendingTopics: trendingResults.map((r: any) => r.title || ''),
              snippet: trendingResults[0]?.snippet || ''
            });
            
            console.log(`Found ${trendingResults.length} trending topics for "${term}"`);
          }
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error querying trends for "${term}":`, error);
        }
      }

      // Step 4: Verify the top trending term with a final Serper search
      if (trendEstimates.length > 0) {
        const topEstimate = trendEstimates.reduce((max: any, curr: any) => 
          curr.popularityScore > max.popularityScore ? curr : max
        );

        console.log(`Verifying top trend "${topEstimate.searchTerm}" with final search...`);
        
        try {
          const searchQuery = `${topEstimate.searchTerm} fashion 2025`;
          const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: searchQuery }),
          });

          if (response.ok) {
            const data = await response.json();
            const resultCount = data.searchInformation?.totalResults || 0;
            
            // Find Google Trends data for this term
            const trendsInfo = googleTrendsData.find(t => t.searchTerm === topEstimate.searchTerm);
            
            verifiedTopTrend = {
              searchTerm: topEstimate.searchTerm,
              resultCount: parseInt(resultCount),
              topResult: data.organic?.[0]?.title || null,
              estimatedScore: topEstimate.popularityScore,
              trendsUrl: trendsInfo?.trendsUrl || null,
              trendingTopics: trendsInfo?.trendingTopics || []
            };
            
            console.log(`Verified: Found ${resultCount} results for "${topEstimate.searchTerm}"`);
          }
        } catch (error) {
          console.error('Error verifying top trend:', error);
        }
      }
    }

    console.log('Analyzing outfit against trends...');

    const systemPrompt = `You are a professional fashion analyst. Analyze outfits based on the user's target style and compare against current trends. 

Current trending styles:
${trendsContext}

Extracted outfit search terms: ${searchTerms.join(', ')}

Provide detailed analysis of how well the outfit matches the user's intended style and current trends.`;

    const userPrompt = `The user wants to achieve a "${targetStyle}" style aesthetic. Analyze this outfit image and provide:
1. Overall rating (1-100) for how well it achieves the "${targetStyle}" aesthetic
2. Which current trends it matches from the list
3. Style analysis and feedback
4. Suggested tags
5. Trend match score (0-100) indicating how trendy/current the outfit is`;

    // Fetch image as base64  
    const imageResponse2 = await fetch(imageUrl);
    const imageBuffer2 = await imageResponse2.arrayBuffer();
    const base64Image2 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer2)));

    // Analyze outfit using Gemini API with vision
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `${systemPrompt}\n\n${userPrompt}\n\nReturn a JSON object with this structure:\n{\n  "rating": 1-100,\n  "matchedTrends": ["trend1", "trend2"],\n  "styleAnalysis": "analysis text",\n  "suggestedTags": ["tag1", "tag2"],\n  "trendMatchScore": 0-100\n}` },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image2
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json"
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
      }
      
      throw new Error(`AI analysis failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response received');

    const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      throw new Error('No analysis result from AI');
    }

    const analysis = JSON.parse(responseText);

    // Calculate TikTok trend matches
    const tiktokMatches: any[] = [];
    const matchedItems = new Set<string>();
    
    if (tiktokItems && tiktokItems.length > 0) {
      for (const searchTerm of searchTerms) {
        const termLower = searchTerm.toLowerCase();
        const matchingTiktokItems = tiktokItems.filter((item: any) => 
          item.item_name.toLowerCase().includes(termLower) || 
          termLower.includes(item.item_name.toLowerCase())
        );
        
        for (const match of matchingTiktokItems.slice(0, 3)) {
          if (!matchedItems.has(match.item_name)) {
            matchedItems.add(match.item_name);
            const video = Array.isArray(match.video) ? match.video[0] : match.video;
            tiktokMatches.push({
              itemName: match.item_name,
              category: match.category,
              trendScore: match.trend_score,
              videoUrl: video?.video_url,
              author: video?.author,
              hashtag: video?.hashtag
            });
          }
        }
      }
    }

    const tiktokTrendScore = tiktokMatches.length > 0
      ? Math.round(tiktokMatches.reduce((sum, m) => sum + m.trendScore, 0) / tiktokMatches.length)
      : 0;

    console.log(`Found ${tiktokMatches.length} TikTok matches with average score: ${tiktokTrendScore}`);

    return new Response(
      JSON.stringify({
        success: true,
        rating: analysis.rating,
        trendMatch: analysis.trendMatchScore,
        feedback: analysis.styleAnalysis,
        matchingTrends: analysis.matchedTrends,
        extractedHashtags: searchTerms,
        trendEstimates: trendEstimates,
        googleTrendsData: googleTrendsData,
        verifiedTopTrend: verifiedTopTrend,
        tiktokMatches: tiktokMatches.slice(0, 5),
        tiktokTrendScore: tiktokTrendScore
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in analyze-outfit function:', error);
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
