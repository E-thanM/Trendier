import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const OutfitUpload = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const handleUpload = () => {
    setIsAnalyzing(true);
    
    // Simulate analysis
    setTimeout(() => {
      setIsAnalyzing(false);
      toast({
        title: "Analysis Complete!",
        description: "Your outfit has been rated. Scroll down to see results.",
      });
    }, 2000);
  };

  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Upload Your Outfit
          </h2>
          <p className="text-xl text-muted-foreground">
            Get instant AI-powered analysis and rating
          </p>
        </div>

        <Card className="p-8 md:p-12 bg-gradient-card shadow-card border-2 border-border hover:shadow-glow transition-all duration-300">
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-2xl rounded-full" />
                <Upload className="h-16 w-16 text-primary relative z-10" />
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  Drop your outfit photo here
                </h3>
                <p className="text-muted-foreground">
                  or click to browse your files
                </p>
              </div>

              <div className="flex flex-wrap gap-4 justify-center">
                <Button 
                  variant="default" 
                  size="lg"
                  onClick={handleUpload}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5" />
                      Upload Photo
                    </>
                  )}
                </Button>
                <Button variant="secondary" size="lg">
                  <Camera className="h-5 w-5" />
                  Take Photo
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                Supported formats: JPG, PNG, WebP (Max 10MB)
              </p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
};
