// AI-powered video content analysis for fashion trends

interface VideoAnalysisResult {
  clothing_items: string[];
  brands_detected: string[];
  colors: string[];
  style: string;
  materials: string[];
  occasion: string;
  confidence: number;
}

/**
 * Analyzes video thumbnail/content to identify fashion elements
 * Uses AI vision to detect actual clothing, brands, and styling
 */
export async function analyzeVideoContent(
  videoUrl: string,
  thumbnailUrl: string,
  description: string,
  lovableApiKey: string
): Promise<VideoAnalysisResult> {
  try {
    const analysisPrompt = `Analyze this fashion/style video and identify:
1. Specific clothing items visible (e.g., "oversized blazer", "cargo pants", "chunky sneakers")
2. Brand names or logos visible on clothing, accessories, or mentioned
3. Dominant colors in the outfit
4. Overall style aesthetic (e.g., "streetwear", "minimalist", "y2k")
5. Materials that appear to be used (e.g., "denim", "leather", "knit")
6. Occasion/context for the outfit (e.g., "casual", "formal", "athleisure")

Video description: ${description}

Be specific and detailed. Focus on actual visual elements in the video/thumbnail.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              { type: "image_url", image_url: { url: thumbnailUrl } }
            ]
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_fashion_content",
            description: "Extract structured fashion information from video",
            parameters: {
              type: "object",
              properties: {
                clothing_items: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of specific clothing items visible"
                },
                brands_detected: {
                  type: "array",
                  items: { type: "string" },
                  description: "Brand names or logos identified"
                },
                colors: {
                  type: "array",
                  items: { type: "string" },
                  description: "Dominant colors in the outfit"
                },
                style: {
                  type: "string",
                  description: "Overall style aesthetic"
                },
                materials: {
                  type: "array",
                  items: { type: "string" },
                  description: "Materials identified in the clothing"
                },
                occasion: {
                  type: "string",
                  description: "Occasion or context for the outfit"
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0-1 for the analysis"
                }
              },
              required: ["clothing_items", "brands_detected", "colors", "style", "materials", "occasion", "confidence"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_fashion_content" } }
      }),
    });

    if (!response.ok) {
      console.error("AI vision analysis failed:", response.status);
      return createFallbackAnalysis(description);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const analysis = JSON.parse(toolCall.function.arguments);
      return analysis;
    }

    return createFallbackAnalysis(description);
  } catch (error) {
    console.error("Error analyzing video content:", error);
    return createFallbackAnalysis(description);
  }
}

/**
 * Creates a fallback analysis when vision AI fails
 * Uses text description as backup
 */
function createFallbackAnalysis(description: string): VideoAnalysisResult {
  const lowerDesc = description.toLowerCase();
  
  return {
    clothing_items: extractKeywords(lowerDesc, ["outfit", "wearing", "dress", "jeans", "top", "shoes"]),
    brands_detected: extractKeywords(lowerDesc, ["nike", "adidas", "zara", "shein", "gucci", "prada"]),
    colors: extractKeywords(lowerDesc, ["black", "white", "red", "blue", "green", "pink", "brown"]),
    style: detectStyle(lowerDesc),
    materials: extractKeywords(lowerDesc, ["leather", "denim", "silk", "cotton", "wool"]),
    occasion: detectOccasion(lowerDesc),
    confidence: 0.3
  };
}

function extractKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter(keyword => text.includes(keyword));
}

function detectStyle(text: string): string {
  const styles = ["streetwear", "vintage", "y2k", "minimalist", "grunge", "preppy", "casual", "formal"];
  for (const style of styles) {
    if (text.includes(style)) return style;
  }
  return "casual";
}

function detectOccasion(text: string): string {
  const occasions = ["party", "work", "casual", "formal", "date", "gym", "beach"];
  for (const occasion of occasions) {
    if (text.includes(occasion)) return occasion;
  }
  return "everyday";
}

/**
 * Aggregates multiple video analyses to identify broader trends
 */
export function aggregateTrendData(analyses: VideoAnalysisResult[]): {
  top_items: string[];
  trending_brands: string[];
  popular_colors: string[];
  emerging_styles: string[];
} {
  const itemCounts = new Map<string, number>();
  const brandCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  const styleCounts = new Map<string, number>();

  for (const analysis of analyses) {
    // Count clothing items
    for (const item of analysis.clothing_items) {
      itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
    }
    
    // Count brands
    for (const brand of analysis.brands_detected) {
      brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
    }
    
    // Count colors
    for (const color of analysis.colors) {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
    
    // Count styles
    if (analysis.style) {
      styleCounts.set(analysis.style, (styleCounts.get(analysis.style) || 0) + 1);
    }
  }

  return {
    top_items: getTopN(itemCounts, 20),
    trending_brands: getTopN(brandCounts, 15),
    popular_colors: getTopN(colorCounts, 10),
    emerging_styles: getTopN(styleCounts, 10),
  };
}

function getTopN(map: Map<string, number>, n: number): string[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}
