import { useEffect, useRef, useState, useCallback } from "react"

interface WebSocketMessage {
  type: string
  [key: string]: unknown
}

interface UseWebSocketOptions {
  url: string
  onMessage?: (data: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  reconnectInterval?: number
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectInterval = 5000,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        setIsConnected(true)
        onConnect?.()
      }

      ws.onclose = () => {
        setIsConnected(false)
        onDisconnect?.()
        // Reconnect
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval)
      }

      ws.onerror = (error) => {
        console.error("WebSocket error:", error)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage?.(data)
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e)
        }
      }

      wsRef.current = ws
    } catch (e) {
      console.error("Failed to connect WebSocket:", e)
      reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval)
    }
  }, [url, onMessage, onConnect, onDisconnect, reconnectInterval])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    wsRef.current?.close()
  }, [])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { isConnected, send, connect, disconnect }
}
