import { useEffect, useRef, useState, useCallback } from "react";

export interface RealtimeMessage {
  type: string;
  resource: "vm" | "snapshot";
  action: "ADDED" | "MODIFIED" | "DELETED";
  data: any;
  timestamp: number;
}

interface UseRealtimeUpdatesOptions {
  onVMUpdate?: (action: string, data: any) => void;
  onSnapshotUpdate?: (action: string, data: any) => void;
  enabled?: boolean;
}

export function useRealtimeUpdates(options: UseRealtimeUpdatesOptions = {}) {
  const { onVMUpdate, onSnapshotUpdate, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log("Realtime WebSocket connected");
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (enabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`WebSocket closed. Reconnecting in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          // Handle multiple messages separated by newlines
          const messages = event.data.split("\n").filter(Boolean);
          
          for (const msgStr of messages) {
            const message: RealtimeMessage = JSON.parse(msgStr);
            setLastMessage(message);

            // Route to appropriate handler
            if (message.resource === "vm" && onVMUpdate) {
              onVMUpdate(message.action, message.data);
            } else if (message.resource === "snapshot" && onSnapshotUpdate) {
              onSnapshotUpdate(message.action, message.data);
            }
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
    }
  }, [enabled, onVMUpdate, onSnapshotUpdate]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    reconnect: connect,
    disconnect,
  };
}

// Hook for VM list with realtime updates
export function useVMListRealtime(initialVMs: any[] = []) {
  const [vms, setVMs] = useState(initialVMs);

  const handleVMUpdate = useCallback((action: string, data: any) => {
    setVMs((currentVMs) => {
      switch (action) {
        case "ADDED":
          // Check if VM already exists
          if (currentVMs.some((vm) => vm.id === data.id)) {
            return currentVMs;
          }
          return [...currentVMs, data];

        case "MODIFIED":
          return currentVMs.map((vm) =>
            vm.id === data.id ? { ...vm, ...data } : vm
          );

        case "DELETED":
          return currentVMs.filter((vm) => vm.id !== data.id);

        default:
          return currentVMs;
      }
    });
  }, []);

  const { isConnected, lastMessage } = useRealtimeUpdates({
    onVMUpdate: handleVMUpdate,
    enabled: true,
  });

  // Update VMs when initial data changes
  useEffect(() => {
    setVMs(initialVMs);
  }, [initialVMs]);

  return {
    vms,
    setVMs,
    isConnected,
    lastMessage,
  };
}

// Hook for snapshot list with realtime updates
export function useSnapshotListRealtime(initialSnapshots: any[] = []) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);

  const handleSnapshotUpdate = useCallback((action: string, data: any) => {
    setSnapshots((currentSnapshots) => {
      switch (action) {
        case "ADDED":
          if (currentSnapshots.some((s) => s.id === data.id)) {
            return currentSnapshots;
          }
          return [...currentSnapshots, data];

        case "MODIFIED":
          return currentSnapshots.map((s) =>
            s.id === data.id ? { ...s, ...data } : s
          );

        case "DELETED":
          return currentSnapshots.filter((s) => s.id !== data.id);

        default:
          return currentSnapshots;
      }
    });
  }, []);

  const { isConnected, lastMessage } = useRealtimeUpdates({
    onSnapshotUpdate: handleSnapshotUpdate,
    enabled: true,
  });

  useEffect(() => {
    setSnapshots(initialSnapshots);
  }, [initialSnapshots]);

  return {
    snapshots,
    setSnapshots,
    isConnected,
    lastMessage,
  };
}

export default useRealtimeUpdates;
