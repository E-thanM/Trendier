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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    // Step 1: Extract fashion elements and convert to hashtags
    const extractionPrompt = `Analyze this outfit image and extract fashion elements. For each element, provide a search-friendly hashtag.

Focus on:
- Clothing items (e.g., #croppedjacket, #widelegjeans)
- Brands visible (e.g., #nike, #zara)
- Colors (e.g., #allblack, #pastelcolors)
- Styles/aesthetics (e.g., #streetwear, #y2k)
- Patterns (e.g., #plaid, #florals)
- Accessories (e.g., #sneakers, #sunglasses)

Return 5-10 highly specific hashtags that would be used on TikTok/Instagram to search for similar fashion content.`;

    const hashtagResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
                text: extractionPrompt
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_hashtags",
              description: "Extract fashion hashtags from outfit",
              parameters: {
                type: "object",
                properties: {
                  hashtags: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of hashtags without # symbol"
                  }
                },
                required: ["hashtags"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_hashtags" } }
      }),
    });

    if (!hashtagResponse.ok) {
      throw new Error('Failed to extract hashtags');
    }

    const hashtagData = await hashtagResponse.json();
    const hashtags = JSON.parse(hashtagData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{"hashtags":[]}').hashtags;
    
    console.log(`Extracted ${hashtags.length} hashtags:`, hashtags);

    // Step 2: Use Gemini to estimate trend popularity (saves Serper API calls)
    console.log('Estimating trend popularity with Gemini...');
    
    const trendEstimationPrompt = `Based on your knowledge of current fashion trends (as of your training data), estimate the popularity and relevance of these fashion hashtags on a scale of 0-100:

Hashtags: ${hashtags.join(', ')}

For each hashtag, provide:
1. Popularity score (0-100) - how trending is this term
2. Brief context (why it's popular/not popular)
3. Related trends

Use your knowledge of TikTok, Instagram fashion trends, runway shows, and street style.`;

    const estimationResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: trendEstimationPrompt
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "estimate_trend_popularity",
              description: "Estimate popularity of fashion hashtags",
              parameters: {
                type: "object",
                properties: {
                  estimates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        hashtag: { type: "string" },
                        popularityScore: { type: "number", minimum: 0, maximum: 100 },
                        context: { type: "string" },
                        relatedTrends: { type: "array", items: { type: "string" } }
                      },
                      required: ["hashtag", "popularityScore", "context"]
                    }
                  }
                },
                required: ["estimates"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "estimate_trend_popularity" } }
      }),
    });

    const estimationData = await estimationResponse.json();
    const trendEstimates = JSON.parse(estimationData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || '{"estimates":[]}').estimates;

    console.log('Trend estimates:', trendEstimates);

    // Step 3: Only use Serper API for top trending item (saves quota)
    const SERPER_API_KEY = Deno.env.get('SERPER_API_KEY');
    const trendSearchResults: any[] = [];
    let verifiedTopTrend = null;

    if (SERPER_API_KEY && trendEstimates.length > 0) {
      // Find highest scoring hashtag
      const topEstimate = trendEstimates.reduce((max: any, curr: any) => 
        curr.popularityScore > max.popularityScore ? curr : max
      );

      console.log(`Verifying top trend #${topEstimate.hashtag} with Serper API...`);
      
      try {
        const searchQuery = `${topEstimate.hashtag} fashion trend tiktok 2025`;
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
          
          verifiedTopTrend = {
            hashtag: topEstimate.hashtag,
            resultCount: parseInt(resultCount),
            topResult: data.organic?.[0]?.title || null,
            estimatedScore: topEstimate.popularityScore
          };
          
          console.log(`Verified: Found ${resultCount} results for #${topEstimate.hashtag}`);
        }
      } catch (error) {
        console.error('Error verifying top trend:', error);
      }
    }

    console.log('Analyzing outfit against trends...');

    const systemPrompt = `You are a professional fashion analyst. Analyze outfits based on the user's target style and compare against current trends. 

Current trending styles:
${trendsContext}

Extracted outfit hashtags: ${hashtags.join(', ')}

Provide detailed analysis of how well the outfit matches the user's intended style and current trends.`;

    const userPrompt = `The user wants to achieve a "${targetStyle}" style aesthetic. Analyze this outfit image and provide:
1. Overall rating (1-10) for how well it achieves the "${targetStyle}" aesthetic
2. Which current trends it matches from the list
3. Style analysis and feedback
4. Suggested tags
5. Trend match score (0-100) indicating how trendy/current the outfit is`;

    // Analyze outfit using Lovable AI with vision
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
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_outfit",
              description: "Analyze an outfit and provide structured feedback",
              parameters: {
                type: "object",
                properties: {
                  rating: {
                    type: "number",
                    description: "Overall fashion rating from 1-10"
                  },
                  matchedTrends: {
                    type: "array",
                    items: { type: "string" },
                    description: "Names of trends that match this outfit"
                  },
                  styleAnalysis: {
                    type: "string",
                    description: "Brief analysis of the outfit style"
                  },
                  suggestedTags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Suggested style tags for this outfit"
                  },
                  trendMatchScore: {
                    type: "number",
                    description: "How well it matches current trends (0-100)"
                  }
                },
                required: ["rating", "matchedTrends", "styleAnalysis", "suggestedTags", "trendMatchScore"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "analyze_outfit" } }
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

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No analysis result from AI');
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        success: true,
        rating: analysis.rating,
        trendMatch: analysis.trendMatchScore,
        feedback: analysis.styleAnalysis,
        matchingTrends: analysis.matchedTrends,
        extractedHashtags: hashtags,
        trendEstimates: trendEstimates,
        verifiedTopTrend: verifiedTopTrend
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
