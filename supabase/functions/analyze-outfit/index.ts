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

// Queue system placeholder - will be processed by frontend polling
// Rate limiting is handled at the application level

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

    // Check cache first - use image URL + target style as cache key
    const cacheKey = `${imageUrl}_${targetStyle}`;
    const { data: cachedResult } = await supabaseClient
      .from('outfit_analysis_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // 1 hour cache
      .single();

    if (cachedResult) {
      console.log('Returning cached analysis result');
      return new Response(
        JSON.stringify(cachedResult.result),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

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

Return 4-5 general search terms that would work well in Google Search.`;

    // Fetch image as base64
    const imageResponse1 = await fetch(imageUrl);
    const imageBuffer1 = await imageResponse1.arrayBuffer();
    const uint8Array1 = new Uint8Array(imageBuffer1);
    let binaryString1 = '';
    for (let i = 0; i < uint8Array1.length; i++) {
      binaryString1 += String.fromCharCode(uint8Array1[i]);
    }
    const base64Image1 = btoa(binaryString1);

    let searchTerms: string[] = [];

    // Try Gemini first
    if (geminiApiKey) {
      try {
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
              temperature: 0.1,
              topK: 32,
              topP: 1,
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          }),
        });

        if (hashtagResponse.ok) {
          const hashtagData = await hashtagResponse.json();
          searchTerms = JSON.parse(hashtagData.candidates?.[0]?.content?.parts?.[0]?.text || '{"searchTerms":[]}').searchTerms;
          console.log(`✅ Gemini extracted ${searchTerms.length} search terms:`, searchTerms);
        } else if (hashtagResponse.status === 429) {
          console.log(`⚠️ Gemini rate limit hit for extraction, falling back to Lovable AI`);
        }
      } catch (error) {
        console.log(`⚠️ Gemini failed for extraction, trying Lovable AI:`, error);
      }
    }

    // Fallback to Lovable AI if Gemini fails
    if (searchTerms.length === 0 && lovableApiKey) {
      try {
        const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                { type: 'text', text: extractionPrompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }],
            tools: [{
              type: "function",
              function: {
                name: "extract_search_terms",
                description: "Extract fashion search terms",
                parameters: {
                  type: "object",
                  properties: {
                    searchTerms: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["searchTerms"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "extract_search_terms" } }
          }),
        });

        if (lovableResponse.ok) {
          const lovableData = await lovableResponse.json();
          const toolCall = lovableData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            searchTerms = parsed.searchTerms || [];
            console.log(`✅ Lovable AI extracted ${searchTerms.length} search terms`);
          }
        }
      } catch (error) {
        console.error('Lovable AI fallback failed:', error);
      }
    }

    if (searchTerms.length === 0) {
      throw new Error('Failed to extract search terms from both Gemini and Lovable AI');
    }

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
      .limit(200);

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

    let trendEstimates: any[] = [];

    // Try Gemini first
    if (geminiApiKey) {
      try {
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
              temperature: 0.1,
              topK: 32,
              topP: 1,
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          }),
        });

        if (estimationResponse.ok) {
          const estimationData = await estimationResponse.json();
          trendEstimates = JSON.parse(estimationData.candidates?.[0]?.content?.parts?.[0]?.text || '{"estimates":[]}').estimates;
          console.log(`✅ Gemini estimated trends for ${trendEstimates.length} terms`);
        } else if (estimationResponse.status === 429) {
          console.log(`⚠️ Gemini rate limit hit for estimation, falling back to Lovable AI`);
        }
      } catch (error) {
        console.log(`⚠️ Gemini failed for estimation, trying Lovable AI:`, error);
      }
    }

    // Fallback to Lovable AI
    if (trendEstimates.length === 0 && lovableApiKey) {
      try {
        const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: trendEstimationPrompt
            }],
            tools: [{
              type: "function",
              function: {
                name: "estimate_trends",
                description: "Estimate fashion trend popularity",
                parameters: {
                  type: "object",
                  properties: {
                    estimates: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          searchTerm: { type: "string" },
                          popularityScore: { type: "number" },
                          context: { type: "string" },
                          relatedTrends: { type: "array", items: { type: "string" } }
                        }
                      }
                    }
                  },
                  required: ["estimates"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "estimate_trends" } }
          }),
        });

        if (lovableResponse.ok) {
          const lovableData = await lovableResponse.json();
          const toolCall = lovableData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            const parsed = JSON.parse(toolCall.function.arguments);
            trendEstimates = parsed.estimates || [];
            console.log(`✅ Lovable AI estimated trends`);
          }
        }
      } catch (error) {
        console.error('Lovable AI fallback failed for estimation:', error);
      }
    }

    console.log('Trend estimates:', trendEstimates);

    // Step 3: Query Google Trends through Serper, then verify top trend
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    const googleTrendsData: any[] = [];
    let verifiedTopTrend = null;

    if (SERPER_API_KEY && searchTerms.length > 0) {
      console.log('Querying Google Trends for search terms in parallel...');
      
      // Parallelize all Google Trends searches for speed
      const trendsPromises = searchTerms.map(async (term) => {
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
              num: 5
            }),
          });

          if (trendsResponse.ok) {
            const trendsData = await trendsResponse.json();
            const trendingResults = trendsData.organic?.slice(0, 3) || [];
            
            console.log(`Found ${trendingResults.length} trending topics for "${term}"`);
            
            return {
              searchTerm: term,
              trendsUrl: trendingResults[0]?.link || null,
              trendingTopics: trendingResults.map((r: any) => r.title || ''),
              snippet: trendingResults[0]?.snippet || ''
            };
          }
          return null;
        } catch (error) {
          console.error(`Error querying trends for "${term}":`, error);
          return null;
        }
      });
      
      const trendsResults = await Promise.all(trendsPromises);
      googleTrendsData.push(...trendsResults.filter(r => r !== null))

      // Step 4: Verify the top trending term with a final Serper search
      if (trendEstimates.length > 0) {
        const topEstimate = trendEstimates.reduce((max: any, curr: any) => 
          curr.popularityScore > max.popularityScore ? curr : max
        );

        console.log(`Verifying top trend "${topEstimate.searchTerm}" with final search...`);
        
        try {
          const searchQuery = `${topEstimate.searchTerm} fashion`;
          const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
              'X-API-KEY': SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ q: searchQuery, num: 10 }),
          });

          if (response.ok) {
            const data = await response.json();
            const resultCount = data.searchParameters?.total || data.searchInformation?.totalResults || 0;
            
            // Find Google Trends data for this term
            const trendsInfo = googleTrendsData.find(t => t.searchTerm === topEstimate.searchTerm);
            
            verifiedTopTrend = {
              searchTerm: topEstimate.searchTerm,
              resultCount: typeof resultCount === 'string' ? parseInt(resultCount.replace(/,/g, '')) : resultCount,
              topResult: data.organic?.[0]?.title || null,
              estimatedScore: topEstimate.popularityScore,
              trendsUrl: trendsInfo?.trendsUrl || null,
              trendingTopics: trendsInfo?.trendingTopics || []
            };
            
            console.log(`Verified: Found ${verifiedTopTrend.resultCount} results for "${topEstimate.searchTerm}"`);
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
    const uint8Array2 = new Uint8Array(imageBuffer2);
    let binaryString2 = '';
    for (let i = 0; i < uint8Array2.length; i++) {
      binaryString2 += String.fromCharCode(uint8Array2[i]);
    }
    const base64Image2 = btoa(binaryString2);

    let analysis: any = null;

    // Try Gemini first
    if (geminiApiKey) {
      try {
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
              temperature: 0.1,
              topK: 32,
              topP: 1,
              maxOutputTokens: 2048,
              responseMimeType: "application/json"
            }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (responseText) {
            analysis = JSON.parse(responseText);
            console.log('✅ Gemini analysis successful');
          }
        } else if (aiResponse.status === 429) {
          console.log(`⚠️ Gemini rate limit hit for analysis, falling back to Lovable AI`);
        }
      } catch (error) {
        console.log(`⚠️ Gemini failed for analysis, trying Lovable AI:`, error);
      }
    }

    // Fallback to Lovable AI with retry mechanism
    if (!analysis && lovableApiKey) {
      console.log('🔄 Trying Lovable AI for outfit analysis...');
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Lovable AI attempt ${attempt}/3`);
          
          const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{
                role: 'system',
                content: systemPrompt
              }, {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  { type: 'image_url', image_url: { url: imageUrl } }
                ]
              }],
              tools: [{
                type: "function",
                function: {
                  name: "analyze_outfit",
                  description: "Analyze outfit and provide ratings",
                  parameters: {
                    type: "object",
                    properties: {
                      rating: { type: "number", minimum: 1, maximum: 100 },
                      matchedTrends: { type: "array", items: { type: "string" } },
                      styleAnalysis: { type: "string" },
                      suggestedTags: { type: "array", items: { type: "string" } },
                      trendMatchScore: { type: "number", minimum: 0, maximum: 100 }
                    },
                    required: ["rating", "matchedTrends", "styleAnalysis", "suggestedTags", "trendMatchScore"]
                  }
                }
              }],
              tool_choice: { type: "function", function: { name: "analyze_outfit" } }
            }),
          });

          if (!lovableResponse.ok) {
            const errorText = await lovableResponse.text();
            console.error(`❌ Lovable AI HTTP ${lovableResponse.status}: ${errorText}`);
            
            if (lovableResponse.status === 429) {
              console.log('⏳ Rate limited, waiting before retry...');
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
            if (lovableResponse.status === 402) {
              console.error('💳 Payment required - out of Lovable AI credits');
              break;
            }
            // For other errors, continue to next attempt
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
          } else {
            const lovableData = await lovableResponse.json();
            console.log('📦 Lovable AI response structure:', JSON.stringify(lovableData).substring(0, 150));
            
            const toolCall = lovableData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              analysis = JSON.parse(toolCall.function.arguments);
              console.log(`✅ Lovable AI analysis successful on attempt ${attempt}`);
              break;
            } else {
              console.error('❌ No tool call in response. Full response:', JSON.stringify(lovableData));
              if (attempt < 3) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
        } catch (error) {
          console.error(`❌ Lovable AI attempt ${attempt} exception:`, error);
          if (attempt < 3) {
            console.log('Retrying after delay...');
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          } else {
            console.error('All Lovable AI attempts exhausted');
          }
        }
      }
    }

    if (!analysis) {
      console.error('❌ CRITICAL: Both Gemini and Lovable AI failed to analyze outfit');
      throw new Error('Failed to analyze outfit. The AI services are temporarily unavailable. Please try again in a moment.');
    }

    // Calculate TikTok trend matches with visual-based AI comparison
    const tiktokMatches: any[] = [];
    const matchedItems = new Set<string>();
    
    if (tiktokItems && tiktokItems.length > 0) {
      console.log('🎯 Starting visual-based TikTok matching...');
      
      // Step 1: Enhanced keyword filtering to get more candidates
      const searchWords = searchTerms.flatMap(term => 
        term.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      );
      
      // Expanded category map for better matching
      const categoryMap: Record<string, string[]> = {
        'shoes': ['sneakers', 'boots', 'loafers', 'heels', 'sandals', 'footwear', 'kicks'],
        'pants': ['jeans', 'trousers', 'bottoms', 'slacks', 'denim'],
        'shirt': ['t-shirt', 'top', 'blouse', 'tee', 'shirt'],
        'jacket': ['outerwear', 'coat', 'blazer', 'hoodie', 'sweater'],
        'dress': ['gown', 'frock', 'midi', 'maxi'],
        'accessories': ['bag', 'jewelry', 'watch', 'belt', 'hat'],
        'streetwear': ['hoodie', 'joggers', 'sneakers', 'cap'],
        'formal': ['suit', 'dress', 'blazer', 'heels']
      };
      
      // Content filter - exclude inappropriate content
      const inappropriateKeywords = [
        'bikini', 'lingerie', 'underwear', 'bra', 'panties', 'sexy', 'nsfw',
        'nude', 'naked', 'explicit', 'adult', 'suggestive', 'revealing'
      ];
      
      const candidates: any[] = [];
      const scoredItems: Array<{item: any, score: number}> = [];
      
      for (const item of tiktokItems) {
        const itemNameLower = item.item_name.toLowerCase();
        const itemWords = itemNameLower.split(/\s+/);
        
        // Skip inappropriate content
        const hasInappropriateContent = inappropriateKeywords.some(keyword => 
          itemNameLower.includes(keyword)
        );
        
        if (hasInappropriateContent) {
          console.log(`⚠️ Filtered inappropriate content: ${item.item_name}`);
          continue;
        }
        
        let matchScore = 0;
        
        // Direct word match (highest priority)
        const hasDirectMatch = searchWords.some((word: string) => 
          itemWords.some((itemWord: string) => 
            itemWord.includes(word) || word.includes(itemWord)
          )
        );
        if (hasDirectMatch) matchScore += 3;
        
        // Category match
        const hasCategoryMatch = searchWords.some(word => {
          const relatedCategories = categoryMap[word] || [];
          return relatedCategories.some(cat => itemNameLower.includes(cat));
        });
        if (hasCategoryMatch) matchScore += 2;
        
        // Category word match
        const categoryLower = item.category?.toLowerCase() || '';
        const hasCategoryWordMatch = searchWords.some(word => 
          categoryLower.includes(word) || word.includes(categoryLower)
        );
        if (hasCategoryWordMatch) matchScore += 1;
        
        // Style match with target style
        if (targetStyle && itemNameLower.includes(targetStyle.toLowerCase())) {
          matchScore += 2;
        }
        
        if (matchScore > 0 && !matchedItems.has(item.item_name)) {
          matchedItems.add(item.item_name);
          scoredItems.push({ item, score: matchScore });
        }
      }
      
      // Sort by match score and take top 10 for visual analysis
      scoredItems.sort((a, b) => b.score - a.score);
      
      for (const {item} of scoredItems.slice(0, 10)) {
        const video: any = Array.isArray(item.video) ? item.video[0] : item.video;
        
        // Ensure video URL is valid
        const videoUrl = video?.video_url || '';
        const videoId = video?.video_id || '';
        const author = video?.author || '';
        
        // Construct proper TikTok URL if needed
        const properUrl = videoUrl || (videoId && author ? `https://www.tiktok.com/@${author}/video/${videoId}` : '');
        
        candidates.push({
          itemName: item.item_name,
          category: item.category,
          trendScore: item.trend_score,
          videoUrl: properUrl,
          videoId: videoId,
          thumbnailUrl: video?.thumbnail_url,
          author: author,
          hashtag: video?.hashtag
        });
      }
      
      // Fallback to popular items if no matches
      if (candidates.length === 0) {
        console.log('No matches found, using top trending items for visual analysis');
        const popularItems = tiktokItems.slice(0, 10);
        for (const item of popularItems) {
          const video: any = Array.isArray(item.video) ? item.video[0] : item.video;
          const videoUrl = video?.video_url || '';
          const videoId = video?.video_id || '';
          const author = video?.author || '';
          const properUrl = videoUrl || (videoId && author ? `https://www.tiktok.com/@${author}/video/${videoId}` : '');
          
          candidates.push({
            itemName: item.item_name,
            category: item.category,
            trendScore: Math.round(item.trend_score * 0.7),
            videoUrl: properUrl,
            videoId: videoId,
            thumbnailUrl: video?.thumbnail_url,
            author: author,
            hashtag: video?.hashtag
          });
        }
      }
      
      console.log(`📋 Got ${candidates.length} candidates, performing visual AI analysis...`);
      
      // Step 2: Visual comparison using Gemini Vision for top 3 candidates (faster)
      const visualComparisonPromises = candidates.slice(0, 3).map(async (candidate) => {
        if (!candidate.thumbnailUrl) {
          return { ...candidate, visualScore: 0, finalScore: candidate.trendScore };
        }
        
        try {
          const visualPrompt = `You are comparing a user's outfit with a TikTok fashion trend outfit.

TARGET STYLE: ${targetStyle}

Compare these two fashion images specifically for ${targetStyle} aesthetic and rate visual similarity 0-100:
- Does the TikTok outfit match the ${targetStyle} style? (40% weight)
- Color palette similarity (25% weight)
- Clothing item type match (25% weight)
- Overall vibe and aesthetic (10% weight)

Return ONLY a number 0-100. Higher = better style match for ${targetStyle}.

User's outfit (image 1) vs TikTok outfit (image 2)`;

          const requestBody = {
            contents: [{
              parts: [
                { text: visualPrompt },
                { 
                  inline_data: {
                    mime_type: imageUrl.startsWith('data:') 
                      ? imageUrl.split(';')[0].split(':')[1]
                      : 'image/jpeg',
                    data: imageUrl.startsWith('data:')
                      ? imageUrl.split(',')[1]
                      : imageUrl
                  }
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: candidate.thumbnailUrl.startsWith('data:')
                      ? candidate.thumbnailUrl.split(',')[1]
                      : candidate.thumbnailUrl
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 10
            }
          };

          let visualScore = 0;
          
          // Try Gemini first
          try {
            const geminiResponse = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              }
            );

            if (geminiResponse.ok) {
              const geminiData = await geminiResponse.json();
              const scoreText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              visualScore = parseInt(scoreText) || 0;
              console.log(`✅ Visual match for "${candidate.itemName}": ${visualScore}/100`);
            }
          } catch (geminiError) {
            console.log('Gemini visual comparison failed, trying Lovable AI...');
            
            // Fallback to Lovable AI
            const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: [{
                  role: 'user',
                  content: [
                    { type: 'text', text: visualPrompt },
                    { type: 'image_url', image_url: { url: imageUrl } },
                    { type: 'image_url', image_url: { url: candidate.thumbnailUrl } }
                  ]
                }],
                temperature: 0.1,
                max_tokens: 10
              })
            });

            if (lovableResponse.ok) {
              const lovableData = await lovableResponse.json();
              const scoreText = lovableData.choices?.[0]?.message?.content?.trim();
              visualScore = parseInt(scoreText) || 0;
              console.log(`✅ Visual match (Lovable AI) for "${candidate.itemName}": ${visualScore}/100`);
            }
          }
          
          // Combine visual score with trend score (60% visual, 40% trend)
          const finalScore = Math.round(visualScore * 0.6 + candidate.trendScore * 0.4);
          
          return {
            ...candidate,
            visualScore,
            finalScore
          };
        } catch (error) {
          console.error(`Visual comparison failed for ${candidate.itemName}:`, error);
          return { ...candidate, visualScore: 0, finalScore: candidate.trendScore };
        }
      });
      
      // Wait for all visual comparisons
      const visualResults = await Promise.all(visualComparisonPromises);
      
      // Sort by final score and take top 3
      tiktokMatches.push(...visualResults.sort((a, b) => b.finalScore - a.finalScore).slice(0, 3));
      
      console.log(`🎨 Visual analysis complete: ${tiktokMatches.length} matches with visual scoring`);
    }

    const tiktokTrendScore = tiktokMatches.length > 0
      ? Math.round(tiktokMatches.reduce((sum, m) => sum + m.finalScore, 0) / tiktokMatches.length)
      : 0;

    console.log(`Found ${tiktokMatches.length} visually-matched TikTok items with average score: ${tiktokTrendScore}`);

    // Generate outfit pairing recommendations using AI
    const pairingPrompt = `Based on this ${targetStyle} outfit, suggest 2-3 specific items to pair with it that would:
1. Complete or enhance the ${targetStyle} aesthetic
2. Match current fashion trends
3. Create a cohesive, stylish look

Be specific (e.g., "chunky white sneakers" not just "shoes"). For each suggestion, explain why it works.`;

    let pairingRecommendations: any[] = [];
    
    // Try Gemini first  
    if (geminiApiKey) {
      try {
        const pairResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `${pairingPrompt}\n\nReturn JSON:\n{"recommendations": [{"item": "item name", "reason": "why it pairs well", "searchTerm": "shopping search"}]}` },
                { inline_data: { mime_type: "image/jpeg", data: base64Image1 } }
              ]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512,
              responseMimeType: "application/json"
            }
          })
        });

        if (pairResponse.ok) {
          const pairData = await pairResponse.json();
          pairingRecommendations = JSON.parse(pairData.candidates?.[0]?.content?.parts?.[0]?.text || '{"recommendations":[]}').recommendations;
        }
      } catch (error) {
        console.log('Gemini pairing failed, trying Lovable AI');
      }
    }
    
    // Fallback to Lovable AI
    if (pairingRecommendations.length === 0 && lovableApiKey) {
      try {
        const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: pairingPrompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }],
            tools: [{
              type: "function",
              function: {
                name: "suggest_pairings",
                description: "Suggest items to pair with outfit",
                parameters: {
                  type: "object",
                  properties: {
                    recommendations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          item: { type: "string" },
                          reason: { type: "string" },
                          searchTerm: { type: "string" }
                        }
                      }
                    }
                  },
                  required: ["recommendations"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "suggest_pairings" } }
          })
        });

        if (lovableResponse.ok) {
          const lovableData = await lovableResponse.json();
          const toolCall = lovableData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            pairingRecommendations = JSON.parse(toolCall.function.arguments).recommendations || [];
          }
        }
      } catch (error) {
        console.error('Lovable AI pairing failed:', error);
      }
    }

    // Add shopping links to pairing recommendations - use Amazon for better product availability  
    const pairingsWithLinks = pairingRecommendations.slice(0, 3).map(rec => {
      const searchQuery = rec.searchTerm || rec.item;
      return {
        ...rec,
        shopLink: `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&tag=fashiontrend-20`
      };
    });

    // Generate detailed outfit element descriptions using AI
    const elementPrompt = `Analyze this ${targetStyle} outfit and identify the 3 MOST IMPORTANT elements (clothing items, accessories, or style choices).

For each element, provide:
1. Name of the item (e.g., "Oversized Denim Jacket", "Black Chelsea Boots")
2. Why it's key to this ${targetStyle} aesthetic (2-3 sentences)
3. How it contributes to the overall look
4. A specific search term for shopping (e.g., "oversized light wash denim jacket women")

Focus on the most impactful pieces that define the outfit.`;

    let outfitElements: any[] = [];
    
    // Try Gemini first
    if (geminiApiKey) {
      try {
        const elemResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: `${elementPrompt}\n\nReturn JSON:\n{"elements": [{"name": "item name", "description": "why it's important", "searchTerm": "shopping search term"}]}` },
                { inline_data: { mime_type: "image/jpeg", data: base64Image1 } }
              ]
            }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1024,
              responseMimeType: "application/json"
            }
          })
        });

        if (elemResponse.ok) {
          const elemData = await elemResponse.json();
          outfitElements = JSON.parse(elemData.candidates?.[0]?.content?.parts?.[0]?.text || '{"elements":[]}').elements;
        }
      } catch (error) {
        console.log('Gemini elements failed, trying Lovable AI');
      }
    }
    
    // Fallback to Lovable AI
    if (outfitElements.length === 0 && lovableApiKey) {
      try {
        const lovableResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: elementPrompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }],
            tools: [{
              type: "function",
              function: {
                name: "analyze_elements",
                description: "Analyze outfit elements",
                parameters: {
                  type: "object",
                  properties: {
                    elements: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          searchTerm: { type: "string" }
                        }
                      }
                    }
                  },
                  required: ["elements"]
                }
              }
            }],
            tool_choice: { type: "function", function: { name: "analyze_elements" } }
          })
        });

        if (lovableResponse.ok) {
          const lovableData = await lovableResponse.json();
          const toolCall = lovableData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall?.function?.arguments) {
            outfitElements = JSON.parse(toolCall.function.arguments).elements || [];
          }
        }
      } catch (error) {
        console.error('Lovable AI elements failed:', error);
      }
    }

    // Add shopping links to elements - use Amazon for better product availability
    const elementsWithLinks = outfitElements.slice(0, 3).map(elem => {
      const searchQuery = elem.searchTerm || elem.name;
      return {
        ...elem,
        shopLink: `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&tag=fashiontrend-20`
      };
    });

    const finalResult = {
      success: true,
      rating: analysis.rating,
      trendMatch: analysis.trendMatchScore,
      feedback: analysis.styleAnalysis,
      matchingTrends: analysis.matchedTrends,
      outfitElements: elementsWithLinks,
      tiktokMatches: tiktokMatches.slice(0, 3),
      tiktokTrendScore: tiktokTrendScore,
      pairingRecommendations: pairingsWithLinks,
      imageUrl: imageUrl,
      targetStyle: targetStyle
    };

    // Cache the result in background (fire and forget)
    (async () => {
      try {
        await supabaseClient
          .from('outfit_analysis_cache')
          .upsert({
            cache_key: cacheKey,
            user_id: user.id,
            result: finalResult,
            created_at: new Date().toISOString()
          });
        console.log('Result cached successfully');
      } catch {
        console.log('Cache operation failed');
      }
    })();

    return new Response(
      JSON.stringify(finalResult),
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
