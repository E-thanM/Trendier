import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Image, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const OutfitUpload = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleUpload = () => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Complete",
        description: "Your outfit has been rated",
      });
    }, 2000);
  };

  return (
    <section id="upload-section" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            Upload Your Fit
          </h2>
          <p className="text-lg text-muted-foreground font-light">
            Get instant AI-powered style rating
          </p>
        </div>

        <Card className="p-8 bg-background shadow-soft border border-border rounded-3xl hover:shadow-medium transition-shadow">
          <div className="border-2 border-dashed border-border rounded-2xl p-16 text-center hover:border-primary/50 transition-colors cursor-pointer">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-story p-[2px]">
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                    <Upload className="h-8 w-8 text-foreground" />
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-1">
                  Drop your photo here
                </h3>
                <p className="text-muted-foreground text-sm font-light">
                  or tap to browse
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="instagram" 
                  size="lg"
                  onClick={handleUpload}
                  disabled={isAnalyzing}
                  className="rounded-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing
                    </>
                  ) : (
                    <>
                      <Image className="h-4 w-4" />
                      Upload Photo
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground font-light">
                JPG, PNG, or WebP • Max 10MB
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
