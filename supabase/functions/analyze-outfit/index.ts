import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, caption } = await req.json();
    
    if (!imageUrl) {
      throw new Error('Image URL is required');
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fetching current trends...');
    
    // Fetch current trends
    const { data: trends, error: trendsError } = await supabase
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

    console.log('Analyzing outfit with AI...');

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
            content: `You are a professional fashion analyst. Analyze outfits and provide ratings based on current trends. Current trending styles:\n\n${trendsContext}\n\nProvide a rating from 1-10 and identify which trends the outfit matches.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this outfit${caption ? ` (caption: "${caption}")` : ''} and rate it based on current fashion trends. Provide:\n1. Overall rating (1-10)\n2. Which trends it matches\n3. Style analysis\n4. Suggested tags`
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
        analysis: {
          rating: analysis.rating,
          matchedTrends: analysis.matchedTrends,
          styleAnalysis: analysis.styleAnalysis,
          suggestedTags: analysis.suggestedTags,
          trendMatchScore: analysis.trendMatchScore
        }
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
