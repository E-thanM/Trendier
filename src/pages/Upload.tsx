import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, Loader2 } from "lucide-react";

export default function Upload() {
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tags, setTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageUrl) {
      toast({
        title: "Error",
        description: "Please enter an image URL",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to upload",
          variant: "destructive",
        });
        return;
      }

      const styleTags = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error } = await supabase.from("outfits").insert({
        user_id: user.id,
        image_url: imageUrl,
        caption: caption || null,
        style_tags: styleTags.length > 0 ? styleTags : null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Outfit uploaded successfully!",
      });

      navigate("/");
    } catch (error) {
      console.error("Error uploading outfit:", error);
      toast({
        title: "Error",
        description: "Failed to upload outfit",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Upload Outfit</h1>
        <p className="text-muted-foreground">Share your style with the community</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="imageUrl">Image URL</Label>
          <Input
            id="imageUrl"
            type="url"
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
          />
          <p className="text-xs text-muted-foreground">
            Enter a direct link to your outfit image
          </p>
        </div>

        {imageUrl && (
          <div className="aspect-square bg-muted rounded-lg overflow-hidden">
            <img
              src={imageUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={() => {
                toast({
                  title: "Invalid image",
                  description: "Please check your image URL",
                  variant: "destructive",
                });
              }}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            placeholder="Describe your outfit..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Style Tags</Label>
          <Input
            id="tags"
            placeholder="streetwear, minimalist, vintage (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={uploading}>
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <UploadIcon className="mr-2 h-4 w-4" />
              Upload Outfit
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
