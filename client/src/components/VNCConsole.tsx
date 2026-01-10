import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Maximize2, Minimize2, RefreshCw, X, Monitor, Loader2 } from "lucide-react";

interface VNCConsoleProps {
  vmName: string;
  onClose?: () => void;
}

export function VNCConsole({ vmName, onClose }: VNCConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    // Connect to VNC WebSocket proxy
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/vms/${vmName}/vnc`;

    try {
      const ws = new WebSocket(wsUrl, ["binary"]);
      wsRef.current = ws;

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        console.log("VNC WebSocket connected");
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        if (event.code !== 1000) {
          setError(`Connection closed: ${event.reason || "Unknown reason"}`);
        }
        console.log("VNC WebSocket closed:", event.code, event.reason);
      };

      ws.onerror = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        setError("Failed to connect to VNC");
        console.error("VNC WebSocket error:", event);
      };

      ws.onmessage = (event) => {
        // Handle VNC protocol messages
        // In a full implementation, this would use noVNC library
        // For now, we show a placeholder
        handleVNCMessage(event.data);
      };
    } catch (err) {
      setIsConnecting(false);
      setError(`Connection error: ${err}`);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const handleVNCMessage = (data: ArrayBuffer) => {
    // Placeholder for VNC protocol handling
    // In production, integrate with noVNC library
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw a placeholder indicating connection is active
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#00d9ff";
    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("VNC Stream Active", canvas.width / 2, canvas.height / 2);
    ctx.fillText(`Receiving data: ${data.byteLength} bytes`, canvas.width / 2, canvas.height / 2 + 20);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      disconnect();
    };
  }, []);

  // Draw initial canvas state
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#6b7280";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Click 'Connect' to start VNC session", canvas.width / 2, canvas.height / 2);
  }, []);

  return (
    <Card ref={containerRef} className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Monitor className="h-4 w-4 text-cyan-400" />
          VNC Console - {vmName}
        </CardTitle>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={disconnect}
                className="h-8 px-2"
              >
                <X className="h-4 w-4 mr-1" />
                Disconnect
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  disconnect();
                  setTimeout(connect, 500);
                }}
                className="h-8 px-2"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={connect}
              disabled={isConnecting}
              className="h-8 bg-cyan-600 hover:bg-cyan-700"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative bg-black rounded-b-lg overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connect}
                  className="border-red-400 text-red-400 hover:bg-red-400/10"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-auto"
            style={{ aspectRatio: "4/3" }}
          />
          {isConnected && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 px-2 py-1 rounded text-xs">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-400">Connected</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default VNCConsole;
