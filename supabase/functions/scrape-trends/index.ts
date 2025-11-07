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
    console.log('Starting trend scraping process...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Simulated trending fashion data (in production, this would scrape from TikTok/Instagram APIs)
    const trendingStyles = [
      {
        name: "Y2K Revival",
        description: "Low-rise jeans, baby tees, and butterfly clips making a comeback",
        tags: ["y2k", "vintage", "nostalgic", "2000s"],
        source: "TikTok",
        popularity_score: 95
      },
      {
        name: "Cottagecore Aesthetic",
        description: "Flowy dresses, floral patterns, and romantic countryside vibes",
        tags: ["cottagecore", "floral", "romantic", "vintage"],
        source: "Instagram",
        popularity_score: 88
      },
      {
        name: "Clean Girl Aesthetic",
        description: "Minimal makeup, slicked-back bun, gold jewelry, and neutral tones",
        tags: ["minimal", "clean", "elegant", "neutral"],
        source: "TikTok",
        popularity_score: 92
      },
      {
        name: "Gorpcore",
        description: "Outdoor and hiking-inspired fashion with technical fabrics",
        tags: ["outdoor", "functional", "sporty", "technical"],
        source: "Instagram",
        popularity_score: 85
      },
      {
        name: "Barbiecore",
        description: "All-pink outfits, feminine silhouettes, and playful accessories",
        tags: ["pink", "feminine", "playful", "bold"],
        source: "TikTok",
        popularity_score: 90
      },
      {
        name: "Quiet Luxury",
        description: "Understated elegance with high-quality basics and neutral palette",
        tags: ["minimal", "luxury", "neutral", "timeless"],
        source: "Instagram",
        popularity_score: 87
      },
      {
        name: "Balletcore",
        description: "Ballet-inspired fashion with wrap tops, leg warmers, and soft silhouettes",
        tags: ["ballet", "feminine", "soft", "dance"],
        source: "TikTok",
        popularity_score: 83
      },
      {
        name: "Coastal Grandmother",
        description: "Relaxed, sophisticated style inspired by beach house living",
        tags: ["coastal", "relaxed", "linen", "sophisticated"],
        source: "Instagram",
        popularity_score: 80
      }
    ];

    // Insert trends into database
    const { data, error } = await supabase
      .from('trends')
      .upsert(trendingStyles, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('Error inserting trends:', error);
      throw error;
    }

    console.log(`Successfully scraped and stored ${data?.length || 0} trends`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        trendsCount: data?.length || 0,
        trends: data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in scrape-trends function:', error);
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
