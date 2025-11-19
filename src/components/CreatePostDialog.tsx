import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityId: string | null;
}

export default function CreatePostDialog({
  open,
  onOpenChange,
  communityId,
}: CreatePostDialogProps) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 10) {
      toast({
        title: "Too many images",
        description: "You can upload up to 10 images per post",
        variant: "destructive",
      });
      return;
    }

    setImages((prev) => [...prev, ...files]);
    
    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const createPost = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (images.length === 0) {
        throw new Error("Please add at least one image");
      }

      // Create post
      const postData: any = {
        user_id: user.id,
        title,
        caption,
      };
      
      if (communityId) {
        postData.community_id = communityId;
      }
      
      const { data: post, error: postError } = await supabase
        .from("community_posts")
        .insert(postData)
        .select()
        .single();

      if (postError) throw postError;

      // Upload images
      const imageUrls: { url: string; order: number }[] = [];
      
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${post.id}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("outfits")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("outfits")
          .getPublicUrl(fileName);

        imageUrls.push({ url: publicUrl, order: i });
      }

      // Save image records
      const { error: imagesError } = await supabase
        .from("post_images")
        .insert(
          imageUrls.map((img) => ({
            post_id: post.id,
            image_url: img.url,
            display_order: img.order,
          }))
        );

      if (imagesError) throw imagesError;

      return post;
    },
    onSuccess: () => {
      toast({
        title: "Post created!",
        description: "Your post has been shared with the community.",
      });
      queryClient.invalidateQueries({ queryKey: ["community-posts", communityId] });
      onOpenChange(false);
      setTitle("");
      setCaption("");
      setImages([]);
      setImagePreviews([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a Post</DialogTitle>
          <DialogDescription>
            {communityId ? "Share your style with the community" : "Share your style with everyone"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPost.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              placeholder="Give your post a title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              placeholder="What's your style story? Tag others with @username"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label>Images (up to 10)</Label>
            
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-xs text-white">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
              <input
                type="file"
                id="images"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                disabled={createPost.isPending || images.length >= 10}
              />
              <label htmlFor="images" className="cursor-pointer">
                {images.length === 0 ? (
                  <>
                    <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-1">
                      Click to upload images
                    </p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WEBP (max 20MB each)
                    </p>
                  </>
                ) : images.length < 10 ? (
                  <>
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Add more images ({images.length}/10)
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Maximum 10 images reached
                  </p>
                )}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createPost.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={images.length === 0 || createPost.isPending}
            >
              {createPost.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Post
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
