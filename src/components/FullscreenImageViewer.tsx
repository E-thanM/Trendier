import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FullscreenImageViewerProps {
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

export function FullscreenImageViewer({ imageUrl, isOpen, onClose }: FullscreenImageViewerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full max-h-full w-screen h-screen p-0 border-0 bg-black/95 flex items-center justify-center">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 rounded-full"
        >
          <X className="h-6 w-6" />
        </Button>
        
        <img
          src={imageUrl}
          alt="Fullscreen view"
          className="max-w-full max-h-full w-auto h-auto object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </DialogContent>
    </Dialog>
  );
}
