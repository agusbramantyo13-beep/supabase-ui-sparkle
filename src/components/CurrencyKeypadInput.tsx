import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Delete, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrencyKeypadInputProps {
  /** Raw numeric string value (digits only, e.g. "40000"). */
  value: string;
  /** Called with raw numeric string. */
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional label shown at the top of the modal. */
  label?: string;
  /** Optional quick-fill suggestions in Rupiah, e.g. [50000, 100000]. */
  quickAmounts?: number[];
  /** Optional target amount — enables "Uang Pas" quick action. */
  targetAmount?: number;
  /** Show Rp prefix inside the trigger. Default true. */
  showPrefix?: boolean;
  id?: string;
}

const formatRupiah = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
};

export function CurrencyKeypadInput({
  value,
  onChange,
  placeholder = "0",
  className,
  disabled,
  label = "Masukkan Nominal",
  quickAmounts,
  targetAmount,
  showPrefix = true,
  id,
}: CurrencyKeypadInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string>(value || "");

  useEffect(() => {
    if (open) setDraft(value || "");
  }, [open, value]);

  const appendDigits = (d: string) => {
    setDraft((prev) => {
      const next = (prev + d).replace(/^0+(?=\d)/, "");
      // cap at 15 digits to avoid overflow
      return next.slice(0, 15);
    });
  };

  const backspace = () => setDraft((prev) => prev.slice(0, -1));
  const clearAll = () => setDraft("");

  const confirm = () => {
    onChange(draft.replace(/\D/g, ""));
    setOpen(false);
  };

  const setQuick = (n: number) => setDraft(String(Math.max(0, Math.floor(n))));

  const displayValue = value ? `Rp ${formatRupiah(value)}` : "";

  const keys: Array<{ label: string; onPress: () => void; variant?: "default" | "secondary" | "destructive" | "outline"; className?: string }> = [
    { label: "1", onPress: () => appendDigits("1"), variant: "outline" },
    { label: "2", onPress: () => appendDigits("2"), variant: "outline" },
    { label: "3", onPress: () => appendDigits("3"), variant: "outline" },
    { label: "4", onPress: () => appendDigits("4"), variant: "outline" },
    { label: "5", onPress: () => appendDigits("5"), variant: "outline" },
    { label: "6", onPress: () => appendDigits("6"), variant: "outline" },
    { label: "7", onPress: () => appendDigits("7"), variant: "outline" },
    { label: "8", onPress: () => appendDigits("8"), variant: "outline" },
    { label: "9", onPress: () => appendDigits("9"), variant: "outline" },
    { label: "000", onPress: () => appendDigits("000"), variant: "outline" },
    { label: "0", onPress: () => appendDigits("0"), variant: "outline" },
  ];

  return (
    <>
      <Input
        id={id}
        type="text"
        readOnly
        inputMode="none"
        placeholder={showPrefix ? `Rp ${placeholder}` : placeholder}
        value={displayValue}
        onFocus={(e) => {
          // Blur immediately so mobile keyboards never appear.
          e.currentTarget.blur();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          if (!disabled) setOpen(true);
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          if (!disabled) setOpen(true);
        }}
        disabled={disabled}
        className={cn("cursor-pointer text-lg font-semibold caret-transparent select-none", className)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-md w-[95vw] sm:w-full gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base font-semibold">{label}</DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-3">
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-4 text-right">
              <div className="text-xs text-muted-foreground mb-1">Nominal</div>
              <div className="text-3xl font-bold tabular-nums break-all">
                Rp {draft ? formatRupiah(draft) : "0"}
              </div>
              {targetAmount !== undefined && targetAmount > 0 && (
                <div className="text-xs text-muted-foreground mt-2">
                  Target: Rp {targetAmount.toLocaleString("id-ID")}
                </div>
              )}
            </div>
          </div>

          {(quickAmounts?.length || targetAmount) ? (
            <div className="px-5 pb-3 flex flex-wrap gap-2">
              {targetAmount !== undefined && targetAmount > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setQuick(targetAmount)}
                >
                  Uang Pas
                </Button>
              )}
              {(quickAmounts || []).map((q) => (
                <Button
                  key={q}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setQuick(q)}
                >
                  {q.toLocaleString("id-ID")}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-2">
              {keys.map((k) => (
                <Button
                  key={k.label}
                  type="button"
                  variant={k.variant || "outline"}
                  onClick={k.onPress}
                  className={cn(
                    "h-14 sm:h-16 text-2xl font-semibold tabular-nums active:scale-[0.97] transition-transform",
                    k.className
                  )}
                >
                  {k.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={backspace}
                className="h-14 sm:h-16 text-lg font-semibold active:scale-[0.97] transition-transform"
                aria-label="Hapus satu digit"
              >
                <Delete className="w-6 h-6" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <Button
                type="button"
                variant="destructive"
                onClick={clearAll}
                className="h-12 text-base font-semibold"
              >
                <X className="w-5 h-5 mr-1" />
                Hapus
              </Button>
              <Button
                type="button"
                onClick={confirm}
                className="h-12 text-base font-semibold bg-gradient-primary"
              >
                <Check className="w-5 h-5 mr-1" />
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
