import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, MessageSquare } from "lucide-react";
import { AccountSettings } from "@/components/AccountSettings";
import { ContactUsForm } from "@/components/ContactUsForm";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Settings & Support</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="settings" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="contact">
              <MessageSquare className="h-4 w-4 mr-2" />
              Contact Us
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="mt-6">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <ContactUsForm />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
