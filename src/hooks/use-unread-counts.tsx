import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCounts() {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    fetchUnreadCounts();

    // Set up realtime subscription for messages
    const messagesChannel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCounts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, []);

  const fetchUnreadCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get unread messages count
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (participations) {
        let totalUnread = 0;
        
        for (const part of participations) {
          const { data: messages } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', part.conversation_id)
            .neq('sender_id', user.id)
            .gt('created_at', part.last_read_at || '1970-01-01');

          totalUnread += messages?.length || 0;
        }

        setUnreadMessages(totalUnread);
      }

      // Placeholder for notifications - can be implemented later
      setUnreadNotifications(0);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  return { unreadMessages, unreadNotifications };
}
