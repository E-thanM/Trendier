// Test file to debug conversation creation
// You can run this in the browser console

import { supabase } from "@/integrations/supabase/client";

export async function testConversationCreation() {
  console.log("=== Starting Conversation Creation Test ===");
  
  // Step 1: Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("1. Auth Check:");
  console.log("  User:", user?.id);
  console.log("  Error:", authError);
  
  if (!user) {
    console.error("❌ Not authenticated!");
    return;
  }
  
  // Step 2: Check session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log("2. Session Check:");
  console.log("  Session exists:", !!session);
  console.log("  Access token:", session?.access_token ? "Present" : "Missing");
  console.log("  Error:", sessionError);
  
  // Step 3: Test policy by checking what we can select
  const { data: existingConvs, error: selectError } = await supabase
    .from("conversations")
    .select("*");
  console.log("3. SELECT Test:");
  console.log("  Can read conversations:", !selectError);
  console.log("  Error:", selectError);
  
  // Step 4: Try to insert a conversation
  console.log("4. INSERT Test:");
  const { data: newConv, error: insertError } = await supabase
    .from("conversations")
    .insert({})
    .select()
    .single();
    
  console.log("  Success:", !!newConv);
  console.log("  New conversation ID:", newConv?.id);
  console.log("  Error:", insertError);
  
  if (insertError) {
    console.error("❌ INSERT FAILED:");
    console.error("  Message:", insertError.message);
    console.error("  Code:", insertError.code);
    console.error("  Details:", insertError.details);
    console.error("  Hint:", insertError.hint);
  }
  
  // Step 5: If successful, add participants
  if (newConv) {
    const { error: participantError } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: newConv.id, user_id: user.id }
      ]);
    
    console.log("5. Participant Test:");
    console.log("  Success:", !participantError);
    console.log("  Error:", participantError);
    
    // Clean up test data
    await supabase.from("conversation_participants").delete().eq("conversation_id", newConv.id);
    await supabase.from("conversations").delete().eq("id", newConv.id);
    console.log("  (Test data cleaned up)");
  }
  
  console.log("=== Test Complete ===");
}

// Auto-run on import
if (typeof window !== 'undefined') {
  (window as any).testConversationCreation = testConversationCreation;
  console.log("Test function loaded! Run: window.testConversationCreation()");
}
