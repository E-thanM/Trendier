import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCounts() {
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    fetchUnreadCounts();

    // Set up realtime subscription for messages, notifications, and participant updates
    const messagesChannel = supabase
      .channel('unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadCounts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, (payload) => {
        console.log('Participant updated, refetching counts:', payload);
        fetchUnreadCounts();
      })
      .subscribe();

    // Also refetch on window focus (when user returns to the app)
    const handleFocus = () => fetchUnreadCounts();
    window.addEventListener('focus', handleFocus);

    // Refetch every 5 seconds as a fallback
    const interval = setInterval(fetchUnreadCounts, 5000);

    return () => {
      supabase.removeChannel(messagesChannel);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const fetchUnreadCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadMessages(0);
        setUnreadNotifications(0);
        return;
      }

      // Get unread messages count
      const { data: participations, error: participationsError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (participationsError) {
        console.error('Error fetching participations:', participationsError);
        setUnreadMessages(0);
      } else if (participations && participations.length > 0) {
        let totalUnread = 0;
        
        for (const part of participations) {
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', part.conversation_id)
            .neq('sender_id', user.id)
            .gt('created_at', part.last_read_at || '1970-01-01');

          if (!messagesError) {
            totalUnread += messages?.length || 0;
          }
        }

        setUnreadMessages(totalUnread);
      } else {
        setUnreadMessages(0);
      }

      // Get unread notifications count
      const { data: notifications, error: notificationsError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('read', false);

      if (notificationsError) {
        console.error('Error fetching notifications:', notificationsError);
        setUnreadNotifications(0);
      } else {
        setUnreadNotifications(notifications?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
      setUnreadMessages(0);
      setUnreadNotifications(0);
    }
  };

  return { unreadMessages, unreadNotifications };
}
