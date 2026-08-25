import { useEffect, useState, useRef } from "react";

export function useBarcodeScan(
  enabled: boolean,
  onScan: (code: string) => void,
) {
  const [buffer, setBuffer] = useState("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === "Enter" && buffer.length > 0) {
        e.preventDefault();
        onScan(buffer);
        setBuffer("");
        return;
      }

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setBuffer((prev) => prev + e.key);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => setBuffer(""), 100);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, buffer, onScan]);

  return buffer;
}
