import { CurrencyKeypadInput } from "@/components/CurrencyKeypadInput";

interface Props {
  total: number;
  splitCash: string;
  splitCard: string;
  setSplitCash: (v: string) => void;
  setSplitCard: (v: string) => void;
}

export function SplitPaymentInputs({ total, splitCash, splitCard, setSplitCash, setSplitCard }: Props) {
  const cashNum = Number(splitCash) || 0;
  const cardNum = Number(splitCard) || 0;
  const paid = cashNum + cardNum;
  const remaining = total - paid;
  const change = paid - total;

  const handleCashChange = (raw: string) => {
    setSplitCash(raw);
    const c = Number(raw) || 0;
    if (c < total) {
      setSplitCard(String(total - c));
    } else {
      setSplitCard("0");
    }
  };

  return (
    <div className="space-y-3 p-3 border border-border rounded-lg bg-muted/30">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Jumlah Tunai</label>
        <CurrencyKeypadInput
          value={splitCash}
          onChange={handleCashChange}
          placeholder="0"
          label="Jumlah Tunai"
          targetAmount={total}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Jumlah Kartu</label>
        <CurrencyKeypadInput
          value={splitCard}
          onChange={setSplitCard}
          placeholder="0"
          label="Jumlah Kartu"
        />
      </div>
      <div className="flex justify-between text-sm pt-1">
        <span className="text-muted-foreground">Total Dibayar:</span>
        <span className="font-semibold">Rp {paid.toLocaleString("id-ID")}</span>
      </div>
      {remaining > 0 && (
        <div className="flex justify-between text-sm text-destructive">
          <span>Kurang:</span>
          <span className="font-semibold">Rp {remaining.toLocaleString("id-ID")}</span>
        </div>
      )}
      {change > 0 && (
        <div className="flex justify-between items-center p-2 bg-success/10 rounded">
          <span className="text-sm font-semibold text-success">Kembalian:</span>
          <span className="text-lg font-bold text-success">Rp {change.toLocaleString("id-ID")}</span>
        </div>
      )}
    </div>
  );
}
