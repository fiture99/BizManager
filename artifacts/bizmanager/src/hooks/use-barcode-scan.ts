import { useEffect, useRef, useCallback } from "react";

interface UseBarcodeScanOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  timeout?: number;
  enabled?: boolean;
}

/**
 * Listens for USB barcode scanner input (rapid keyboard events ending with Enter).
 * USB scanners type characters very fast (< 50ms between keystrokes) and end with Enter.
 */
export function useBarcodeScan({
  onScan,
  minLength = 3,
  timeout = 80,
  enabled = true,
}: UseBarcodeScanOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const barcode = bufferRef.current.trim();
    bufferRef.current = "";
    if (barcode.length >= minLength) {
      onScan(barcode);
    }
  }, [onScan, minLength]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focused on an input/textarea/select (unless it's the dedicated scanner input)
      const target = e.target as HTMLElement;
      if (
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") &&
        !target.dataset.barcodeInput
      ) {
        return;
      }

      const now = Date.now();
      const timeSinceLast = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        if (timerRef.current) clearTimeout(timerRef.current);
        flush();
        return;
      }

      // If gap is too large, reset buffer (user is typing manually, not scanning)
      if (timeSinceLast > timeout && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, timeout * 3);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, flush, timeout]);
}
