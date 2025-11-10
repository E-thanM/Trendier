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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting background scraping of common hashtags...');

    // Fetch common hashtags that haven't been scraped in the last 6 hours (for more frequent updates)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const { data: hashtags, error: hashtagError } = await supabaseClient
      .from('tiktok_hashtags')
      .select('*')
      .eq('is_common', true)
      .or(`last_scraped_at.is.null,last_scraped_at.lt.${sixHoursAgo.toISOString()}`)
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(5); // Process 5 hashtags at a time for faster updates

    if (hashtagError) {
      console.error('Error fetching hashtags:', hashtagError);
      throw hashtagError;
    }

    if (!hashtags || hashtags.length === 0) {
      console.log('No hashtags need scraping at this time');
      return new Response(
        JSON.stringify({ success: true, message: 'No hashtags need scraping' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${hashtags.length} hashtags to scrape`);

    // Scrape each hashtag by calling the analyze function
    const results = [];
    for (const hashtag of hashtags) {
      try {
        console.log(`Scraping hashtag: ${hashtag.hashtag}`);
        
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-tiktok-trends`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            hashtag: hashtag.hashtag,
            maxVideos: 30, // Analyze 30 videos per hashtag for comprehensive data
            forceRefresh: true
          })
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            hashtag: hashtag.hashtag,
            success: true,
            videoCount: data.totalVideos
          });
          console.log(`Successfully scraped ${data.totalVideos} videos for #${hashtag.hashtag}`);
        } else {
          console.error(`Failed to scrape ${hashtag.hashtag}:`, await response.text());
          results.push({
            hashtag: hashtag.hashtag,
            success: false,
            error: 'API call failed'
          });
        }

        // Shorter wait between hashtags for faster background scraping
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error scraping ${hashtag.hashtag}:`, error);
        results.push({
          hashtag: hashtag.hashtag,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Scraping complete: ${successCount}/${hashtags.length} hashtags successful`);

    return new Response(
      JSON.stringify({
        success: true,
        totalHashtags: hashtags.length,
        successfulScrapes: successCount,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
