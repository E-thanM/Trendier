import { useState } from "react";
import { Plus } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { StoryViewer } from "./StoryViewer";

const mockStories = [
  { id: "1", username: "Your Story", hasStory: false, isUser: true },
  { id: "2", username: "fashion_lover", hasStory: true },
  { id: "3", username: "style_icon", hasStory: true },
  { id: "4", username: "trendsetter", hasStory: true },
  { id: "5", username: "outfit_daily", hasStory: true },
  { id: "6", username: "chic_vibes", hasStory: true },
];

const storyContent: Record<string, Array<{ id: string; username: string; imageUrl: string; timestamp: string }>> = {
  "fashion_lover": [
    { id: "1", username: "fashion_lover", imageUrl: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600", timestamp: "2h ago" },
    { id: "2", username: "fashion_lover", imageUrl: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600", timestamp: "2h ago" },
  ],
  "style_icon": [
    { id: "1", username: "style_icon", imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600", timestamp: "4h ago" },
  ],
  "trendsetter": [
    { id: "1", username: "trendsetter", imageUrl: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600", timestamp: "5h ago" },
    { id: "2", username: "trendsetter", imageUrl: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=600", timestamp: "5h ago" },
  ],
  "outfit_daily": [
    { id: "1", username: "outfit_daily", imageUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600", timestamp: "8h ago" },
  ],
  "chic_vibes": [
    { id: "1", username: "chic_vibes", imageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600", timestamp: "12h ago" },
  ],
};

export function StoriesBar() {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentStories, setCurrentStories] = useState<Array<{ id: string; username: string; imageUrl: string; timestamp: string }>>([]);

  const handleStoryClick = (username: string) => {
    if (username === "Your Story") return;
    
    const stories = storyContent[username] || [];
    if (stories.length > 0) {
      setCurrentStories(stories);
      setViewerOpen(true);
    }
  };
  return (
    <>
      <div className="border-b border-border bg-background sticky top-0 z-10 md:top-14">
        <ScrollArea className="w-full">
          <div className="flex gap-4 p-4">
            {mockStories.map((story) => (
              <div
                key={story.id}
                onClick={() => handleStoryClick(story.username)}
                className="flex flex-col items-center gap-1 min-w-[70px] cursor-pointer group"
              >
              <div
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
                  story.hasStory
                    ? "bg-gradient-to-tr from-primary via-secondary to-primary p-0.5"
                    : "bg-muted"
                }`}
              >
                <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
                  {story.isUser ? (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <Plus className="h-6 w-6 text-primary" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-sm font-medium">
                      {story.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs text-center max-w-[70px] truncate">
                {story.isUser ? "Your Story" : story.username}
              </span>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>

    <StoryViewer
      isOpen={viewerOpen}
      onClose={() => setViewerOpen(false)}
      stories={currentStories}
    />
    </>
  );
}
