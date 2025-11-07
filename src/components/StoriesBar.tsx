import { Plus } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const mockStories = [
  { id: "1", username: "Your Story", hasStory: false, isUser: true },
  { id: "2", username: "fashion_lover", hasStory: true },
  { id: "3", username: "style_icon", hasStory: true },
  { id: "4", username: "trendsetter", hasStory: true },
  { id: "5", username: "outfit_daily", hasStory: true },
  { id: "6", username: "chic_vibes", hasStory: true },
];

export function StoriesBar() {
  return (
    <div className="border-b border-border bg-background sticky top-0 z-10 md:top-14">
      <ScrollArea className="w-full">
        <div className="flex gap-4 p-4">
          {mockStories.map((story) => (
            <div
              key={story.id}
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
  );
}
