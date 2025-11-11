import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'critical';
  lastSuccessfulScrape: string | null;
  hoursSinceLastSuccess: number | null;
  totalVideos: number;
  videosLast24h: number;
  hashtagHealth: Array<{
    hashtag: string;
    videoCount: number;
    hoursSinceLastScrape: number;
    status: 'healthy' | 'stale' | 'critical';
  }>;
  recommendations: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🏥 Running scraper health check...');

    // Get last successful scrape timestamp
    const { data: lastVideo } = await supabase
      .from('tiktok_videos')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const lastSuccessTime = lastVideo?.created_at ? new Date(lastVideo.created_at) : null;
    const hoursSinceLastSuccess = lastSuccessTime 
      ? (Date.now() - lastSuccessTime.getTime()) / (1000 * 60 * 60)
      : null;

    // Get total video count
    const { count: totalVideos } = await supabase
      .from('tiktok_videos')
      .select('*', { count: 'exact', head: true });

    // Get videos from last 24 hours
    const { count: videosLast24h } = await supabase
      .from('tiktok_videos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Check health per hashtag
    const { data: hashtagStats } = await supabase
      .from('tiktok_videos')
      .select('hashtag, created_at')
      .order('created_at', { ascending: false });

    const hashtagHealth = new Map<string, { latest: Date; count: number }>();
    
    hashtagStats?.forEach(video => {
      const existing = hashtagHealth.get(video.hashtag);
      const videoTime = new Date(video.created_at);
      
      if (!existing || videoTime > existing.latest) {
        hashtagHealth.set(video.hashtag, {
          latest: videoTime,
          count: (existing?.count || 0) + 1
        });
      } else {
        hashtagHealth.set(video.hashtag, {
          ...existing,
          count: existing.count + 1
        });
      }
    });

    const hashtagHealthArray = Array.from(hashtagHealth.entries()).map(([hashtag, data]) => {
      const hoursSince = (Date.now() - data.latest.getTime()) / (1000 * 60 * 60);
      let status: 'healthy' | 'stale' | 'critical';
      
      if (hoursSince < 6) status = 'healthy';
      else if (hoursSince < 24) status = 'stale';
      else status = 'critical';

      return {
        hashtag,
        videoCount: data.count,
        hoursSinceLastScrape: Math.round(hoursSince * 10) / 10,
        status
      };
    }).sort((a, b) => a.hoursSinceLastScrape - b.hoursSinceLastScrape);

    // Determine overall status
    let overall: 'healthy' | 'degraded' | 'critical';
    const recommendations: string[] = [];

    if (!hoursSinceLastSuccess) {
      overall = 'critical';
      recommendations.push('❌ CRITICAL: No videos in database - scraper has never worked');
    } else if (hoursSinceLastSuccess > 12) {
      overall = 'critical';
      recommendations.push(`❌ CRITICAL: Last successful scrape was ${Math.round(hoursSinceLastSuccess)}h ago`);
      recommendations.push('🔧 Action required: Check scraper logs and TikTok data structure changes');
    } else if (hoursSinceLastSuccess > 6) {
      overall = 'degraded';
      recommendations.push(`⚠️ WARNING: Last scrape was ${Math.round(hoursSinceLastSuccess)}h ago`);
      recommendations.push('📋 Monitor: Scraper may be experiencing intermittent failures');
    } else {
      overall = 'healthy';
      recommendations.push('✅ Scraper is working correctly');
    }

    // Check growth rate
    if (videosLast24h === 0 && totalVideos && totalVideos > 0) {
      recommendations.push('⚠️ No new videos added in last 24h - scraping has stopped');
      if (overall === 'healthy') overall = 'degraded';
    } else if (videosLast24h && videosLast24h < 10) {
      recommendations.push(`📉 Low scraping rate: only ${videosLast24h} videos in 24h`);
    }

    // Check stale hashtags
    const staleHashtags = hashtagHealthArray.filter(h => h.status === 'critical');
    if (staleHashtags.length > 0) {
      recommendations.push(`🏷️ ${staleHashtags.length} hashtags critically stale: ${staleHashtags.map(h => h.hashtag).join(', ')}`);
    }

    const healthStatus: HealthStatus = {
      overall,
      lastSuccessfulScrape: lastSuccessTime?.toISOString() || null,
      hoursSinceLastSuccess: hoursSinceLastSuccess ? Math.round(hoursSinceLastSuccess * 10) / 10 : null,
      totalVideos: totalVideos || 0,
      videosLast24h: videosLast24h || 0,
      hashtagHealth: hashtagHealthArray,
      recommendations
    };

    console.log(`🏥 Health check complete: ${overall}`);
    console.log(`📊 Total videos: ${totalVideos}, Last 24h: ${videosLast24h}`);

    // If critical, attempt automatic recovery
    if (overall === 'critical' && hoursSinceLastSuccess && hoursSinceLastSuccess > 12) {
      console.log('🔧 Attempting automatic recovery...');
      
      try {
        // Trigger immediate scrape
        const response = await fetch(`${supabaseUrl}/functions/v1/scrape-common-hashtags`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ forceRefresh: true })
        });

        const result = await response.json();
        console.log('🔧 Recovery scrape result:', result);
        
        if (result.successfulScrapes > 0) {
          recommendations.push(`✅ Auto-recovery successful: scraped ${result.successfulScrapes} hashtags`);
          healthStatus.overall = 'degraded'; // Upgraded from critical
        } else {
          recommendations.push('❌ Auto-recovery failed: scraper still not working');
        }
      } catch (error) {
        console.error('Auto-recovery error:', error);
        recommendations.push('❌ Auto-recovery attempt failed');
      }
    }

    return new Response(
      JSON.stringify(healthStatus),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Health check failed',
        overall: 'critical'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});