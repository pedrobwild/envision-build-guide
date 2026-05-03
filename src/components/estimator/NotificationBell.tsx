import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

interface Notification {
  id: string;
  title: string;
  message: string;
  budget_id: string | null;
  read: boolean;
  created_at: string;
  type: string;
}

export function NotificationBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, message, budget_id, read, created_at, type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 10));
          toast.info(newNotif.title, { description: newNotif.message });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notif: Notification) => {
    if (!notif.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    if (notif.budget_id) {
      setOpen(false);
      navigate(`/admin/budget/${notif.budget_id}`, { state: { from: "/admin/producao" } });
    }
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lida${unreadCount === 1 ? "" : "s"})` : ""}`}
      className="relative h-9 w-9 sm:h-8 sm:w-8"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
          {unreadCount}
        </span>
      )}
    </Button>
  );

  const list = (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold font-display">Notificações</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] text-primary hover:underline tap-target px-2 -mr-2"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: isMobile ? "65vh" : "18rem" }}>
        {notifications.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma notificação</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markAsRead(n)}
              className={`w-full text-left px-3 py-3 border-b border-border/50 hover:bg-muted/50 active:bg-muted transition-colors ${
                !n.read ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start gap-2">
                {!n.read && (
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent
          className="max-h-[85vh]"
          aria-label="Notificações"
        >
          <div
            className="flex flex-col"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))" }}
          >
            {list}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {list}
      </PopoverContent>
    </Popover>
  );
}
