import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function PreferencesSurvey() {
  const [loading, setLoading] = useState(false);
  const [fetchingPreferences, setFetchingPreferences] = useState(true);
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [stylePreferences, setStylePreferences] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);
  const { toast } = useToast();

  const styleOptions = [
    "Casual", "Formal", "Streetwear", "Vintage", "Sporty", 
    "Bohemian", "Minimalist", "Edgy", "Preppy", "Athleisure"
  ];

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching preferences:", error);
        return;
      }

      if (data) {
        setAgeRange(data.age_range || "");
        setGender(data.gender || "");
        setStylePreferences(data.style_preferences || []);
        setHasPreferences(true);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setFetchingPreferences(false);
    }
  };

  const handleStyleToggle = (style: string) => {
    setStylePreferences((prev) =>
      prev.includes(style)
        ? prev.filter((s) => s !== style)
        : [...prev, style]
    );
  };

  const handleSubmit = async () => {
    if (!ageRange || !gender || stylePreferences.length === 0) {
      toast({
        title: "Incomplete Survey",
        description: "Please complete all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          age_range: ageRange,
          gender: gender,
          style_preferences: stylePreferences,
        });

      if (error) throw error;

      toast({
        title: "Preferences Saved",
        description: "Your style preferences have been updated!",
      });
      setHasPreferences(true);
      setIsOpen(false);
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingPreferences) {
    return (
      <Card className="p-6">
        <div className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-6">
        <CollapsibleTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-between"
          >
            <span className="font-semibold">
              {hasPreferences ? "Update Style Preferences" : "Complete Style Quiz"}
            </span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-6 mt-6">
          <div>
            <p className="text-sm text-muted-foreground">
              Help us personalize your feed with better outfit recommendations
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base mb-3 block">Age Range</Label>
              <RadioGroup value={ageRange} onValueChange={setAgeRange}>
                {["13-17", "18-24", "25-34", "35-44", "45-54", "55+"].map((range) => (
                  <div key={range} className="flex items-center space-x-2">
                    <RadioGroupItem value={range} id={range} />
                    <Label htmlFor={range} className="cursor-pointer">{range}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-base mb-3 block">Gender</Label>
              <RadioGroup value={gender} onValueChange={setGender}>
                {["Male", "Female", "Non-binary", "Prefer not to say"].map((g) => (
                  <div key={g} className="flex items-center space-x-2">
                    <RadioGroupItem value={g} id={g} />
                    <Label htmlFor={g} className="cursor-pointer">{g}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-base mb-3 block">Style Preferences (select all that apply)</Label>
              <div className="grid grid-cols-2 gap-3">
                {styleOptions.map((style) => (
                  <div key={style} className="flex items-center space-x-2">
                    <Checkbox
                      id={style}
                      checked={stylePreferences.includes(style)}
                      onCheckedChange={() => handleStyleToggle(style)}
                    />
                    <Label htmlFor={style} className="cursor-pointer">{style}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
