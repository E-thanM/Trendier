import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Story {
  id: string;
  username: string;
  imageUrl: string;
  timestamp: string;
}

interface StoryViewerProps {
  isOpen: boolean;
  onClose: () => void;
  stories: Story[];
  initialIndex?: number;
}

export const StoryViewer = ({ isOpen, onClose, stories, initialIndex = 0 }: StoryViewerProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!isOpen) return;

    setProgress(0);
    const duration = 5000; // 5 seconds per story
    const interval = 50;
    const increment = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, currentIndex]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
    }
  };

  if (stories.length === 0) return null;

  const currentStory = stories[currentIndex];

  if (!currentStory) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md h-[90vh] p-0 bg-black border-none">
        <div className="relative w-full h-full flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
            {stories.map((_, idx) => (
              <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                <Progress 
                  value={idx === currentIndex ? progress : idx < currentIndex ? 100 : 0} 
                  className="h-full bg-white"
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center ring-2 ring-white">
                <span className="text-xs font-semibold text-white">
                  {currentStory.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{currentStory.username}</p>
                <p className="text-white/70 text-xs">{currentStory.timestamp}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Story content */}
          <div className="flex-1 relative">
            <img
              src={currentStory.imageUrl}
              alt={currentStory.username}
              className="w-full h-full object-cover"
            />

            {/* Navigation areas */}
            <div className="absolute inset-0 flex">
              <div 
                className="w-1/3 h-full cursor-pointer" 
                onClick={handlePrevious}
              />
              <div 
                className="w-1/3 h-full cursor-pointer" 
                onClick={() => setProgress(0)}
              />
              <div 
                className="w-1/3 h-full cursor-pointer" 
                onClick={handleNext}
              />
            </div>

            {/* Navigation buttons */}
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            )}
            {currentIndex < stories.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};