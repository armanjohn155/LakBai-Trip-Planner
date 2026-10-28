import { PlusIcon, XIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { TRANSPORT_MODES } from "@/lib/destination-constants";

interface TransportRow {
  mode?: string;
  route?: string;
  duration?: string;
  price_text?: string;
}

interface RepeatableListProps {
  type: "transport" | "tips";
  transportValue?: TransportRow[];
  onTransportChange?: (rows: TransportRow[]) => void;
  tipsValue?: string[];
  onTipsChange?: (tips: string[]) => void;
  max?: number;
  error?: string;
}

export function RepeatableList({
  type,
  transportValue = [],
  onTransportChange,
  tipsValue = [],
  onTipsChange,
  max = 10,
  error,
}: RepeatableListProps) {
  const addTransport = () => {
    if (!onTransportChange) return;
    if (transportValue.length >= max) return;
    onTransportChange([...transportValue, { mode: "", route: "", duration: "", price_text: "" }]);
  };

  const updateTransport = (index: number, key: keyof TransportRow, value: string) => {
    if (!onTransportChange) return;
    const next = [...transportValue];
    next[index] = { ...next[index], [key]: value };
    onTransportChange(next);
  };

  const removeTransport = (index: number) => {
    if (!onTransportChange) return;
    onTransportChange(transportValue.filter((_, i) => i !== index));
  };

  const addTip = () => {
    if (!onTipsChange) return;
    if (tipsValue.length >= (max === 10 ? 15 : max)) return;
    onTipsChange([...tipsValue, ""]);
  };

  const updateTip = (index: number, value: string) => {
    if (!onTipsChange) return;
    const next = [...tipsValue];
    next[index] = value;
    onTipsChange(next);
  };

  const removeTip = (index: number) => {
    if (!onTipsChange) return;
    onTipsChange(tipsValue.filter((_, i) => i !== index));
  };

  const moveTip = (index: number, dir: -1 | 1) => {
    if (!onTipsChange) return;
    const next = [...tipsValue];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onTipsChange(next);
  };

  if (type === "tips") {
    const limit = max === 10 ? 15 : max;
    return (
      <div className="space-y-3">
        {tipsValue.map((tip, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-2 flex h-6 w-6 items-center justify-center rounded-full bg-sand-100 text-xs font-semibold text-lagoon-900 ring-1 ring-inset ring-line">
              {index + 1}
            </span>
            <Input
              value={tip}
              onChange={(e) => updateTip(index, e.target.value)}
              placeholder="Enter a travel tip"
            />
            <div className="mt-1 flex items-center gap-1">
              <button type="button" onClick={() => moveTip(index, -1)} className="rounded-full p-1.5 hover:bg-sand-100" disabled={index === 0}>
                ↑
              </button>
              <button type="button" onClick={() => moveTip(index, 1)} className="rounded-full p-1.5 hover:bg-sand-100" disabled={index === tipsValue.length - 1}>
                ↓
              </button>
              <button type="button" onClick={() => removeTip(index)} className="rounded-full p-1.5 text-red-600 hover:bg-red-50">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={addTip} disabled={tipsValue.length >= limit}>
          <PlusIcon className="h-4 w-4" />
          Add tip
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transportValue.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-xl bg-sand-100/40 p-3 ring-1 ring-inset ring-line md:grid-cols-[120px_1fr_120px_140px_auto]">
          <Select
            value={row.mode || ""}
            onChange={(e) => updateTransport(index, "mode", e.target.value)}
            emptyLabel="Mode"
            options={TRANSPORT_MODES.map((m) => ({ value: m, label: m }))}
          />
          <Input value={row.route || ""} onChange={(e) => updateTransport(index, "route", e.target.value)} placeholder="Route / origin" />
          <Input value={row.duration || ""} onChange={(e) => updateTransport(index, "duration", e.target.value)} placeholder="Duration" />
          <Input value={row.price_text || ""} onChange={(e) => updateTransport(index, "price_text", e.target.value)} placeholder="Price" />
          <button type="button" onClick={() => removeTransport(index)} className="mt-1 rounded-full p-1.5 text-red-600 hover:bg-red-50">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={addTransport} disabled={transportValue.length >= max}>
        <PlusIcon className="h-4 w-4" />
        Add route
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
