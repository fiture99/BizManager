import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Barcode, Keyboard, X } from "lucide-react";
import { useBarcodeScan } from "@/hooks/use-barcode-scan";
import { cn } from "@/lib/utils";

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  enabled?: boolean;
}

export function BarcodeInput({
  onScan,
  isLoading,
  placeholder = "Ready to scan barcode...",
  className,
  enabled = true,
}: BarcodeInputProps) {
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useBarcodeScan({
    onScan,
    enabled: enabled && !manualMode,
  });

  const handleManualSubmit = () => {
    if (manualValue.trim()) {
      onScan(manualValue.trim());
      setManualValue("");
    }
  };

  const handleManualKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleManualSubmit();
  };

  return (
    <div className={cn("flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2", className)}>
      <Barcode className={cn("h-5 w-5 flex-shrink-0", isLoading ? "text-amber-500 animate-pulse" : "text-primary")} />

      {manualMode ? (
        <>
          <Input
            ref={inputRef}
            data-barcode-input="true"
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            onKeyDown={handleManualKeyDown}
            placeholder="Type barcode and press Enter..."
            className="h-7 flex-1 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleManualSubmit}
          >
            Search
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => { setManualMode(false); setManualValue(""); }}
          >
            <X className="h-3 w-3" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-muted-foreground select-none">
            {isLoading ? "Looking up item..." : placeholder}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setManualMode(true)}
          >
            <Keyboard className="h-3 w-3" />
            Manual
          </Button>
        </>
      )}
    </div>
  );
}
