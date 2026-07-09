// ESC/POS Bluetooth printer utility for 58mm thermal receipt printers.
// Optimized for Iware C-58BT and generic 58mm ESC/POS printers.
// Printable area on 58mm paper ≈ 48mm ≈ 32 characters in Font A (12x24 dots).
//
// NOTE: this layout is intentionally NOT the on-screen preview. It is a
// character-grid layout designed for a monospace thermal printer so that
// output is identical regardless of the phone that sends it.

// Common Serial Port Profile (SPP-like GATT) UUIDs used by generic ESC/POS
// thermal printers (e.g. Iware C-58BT, Xprinter, Goojprt, RPP02N, MTP-II, etc.)
const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // most common (incl. Iware C-58BT)
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip BM70/RN4870
];

const PRINTER_CHAR_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
];

const STORAGE_KEY = "bt_printer_device_name";

export type ConnectedPrinter = {
  device: any;
  characteristic: any;
};

let current: ConnectedPrinter | null = null;

export const isWebBluetoothSupported = () =>
  typeof navigator !== "undefined" && !!(navigator as any).bluetooth;

export const getSavedPrinterName = () =>
  typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

export const getCurrentPrinter = () => current;

export async function connectPrinter(): Promise<ConnectedPrinter> {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      "Web Bluetooth tidak tersedia. Buka di Chrome (HTTPS) di Android atau desktop."
    );
  }

  const device = await (navigator as any).bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();

  let writeChar: any = null;
  for (const svc of services) {
    try {
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties?.write || c.properties?.writeWithoutResponse) {
          writeChar = c;
          break;
        }
      }
    } catch {
      /* ignore */
    }
    if (writeChar) break;
  }

  if (!writeChar) {
    try {
      device.gatt.disconnect();
    } catch {}
    throw new Error("Karakteristik tulis printer tidak ditemukan.");
  }

  device.addEventListener("gattserverdisconnected", () => {
    if (current?.device === device) current = null;
  });

  current = { device, characteristic: writeChar };
  try {
    localStorage.setItem(STORAGE_KEY, device.name || "Printer Bluetooth");
  } catch {}
  return current;
}

export function disconnectPrinter() {
  try {
    if (current?.device?.gatt?.connected) {
      current.device.gatt.disconnect();
    }
  } catch {}
  current = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

async function writeChunks(bytes: Uint8Array) {
  if (!current) throw new Error("Printer belum terhubung.");
  const char = current.characteristic;
  // BLE MTU is small — write in chunks. 180 works well on Iware C-58BT.
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    if (char.properties?.writeWithoutResponse) {
      await char.writeValueWithoutResponse(slice);
    } else {
      await char.writeValue(slice);
    }
    // small delay so slow printers don't drop bytes
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ============================================================
// ESC/POS command helpers
// ============================================================
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Encode as latin1/CP437-compatible bytes. Indonesian receipts use plain
// ASCII plus "Rp"; strip anything the printer's ROM cannot render so
// alignment stays correct across devices.
const enc = (s: string) => {
  const cleaned = s
    .replace(/[\u2013\u2014]/g, "-") // en/em dash
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, " ");
  const out = new Uint8Array(cleaned.length);
  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    out[i] = code < 0x80 || code <= 0xff ? code : 0x3f; // '?'
  }
  return out;
};

const cmd = {
  // ESC @ — full reset. Applied at the start of every job so previous
  // state (bold/size/align) never leaks between prints.
  init: () => new Uint8Array([ESC, 0x40]),
  // ESC t 0 — code page PC437 (default on Iware/Xprinter/Goojprt).
  codepage: () => new Uint8Array([ESC, 0x74, 0x00]),
  // ESC 3 n — line spacing in dots (24 = tight, saves paper).
  lineSpacingTight: () => new Uint8Array([ESC, 0x33, 24]),
  alignLeft: () => new Uint8Array([ESC, 0x61, 0]),
  alignCenter: () => new Uint8Array([ESC, 0x61, 1]),
  alignRight: () => new Uint8Array([ESC, 0x61, 2]),
  boldOn: () => new Uint8Array([ESC, 0x45, 1]),
  boldOff: () => new Uint8Array([ESC, 0x45, 0]),
  doubleSize: () => new Uint8Array([GS, 0x21, 0x11]),
  normalSize: () => new Uint8Array([GS, 0x21, 0x00]),
  cut: () => new Uint8Array([GS, 0x56, 0x42, 0x00]),
  feed: (n = 2) => new Uint8Array([ESC, 0x64, n]),
  newline: () => new Uint8Array([LF]),
};

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ============================================================
// Layout constants — 58mm paper, Font A (32 chars)
// ============================================================
const WIDTH = 32;
const SEP = "-".repeat(WIDTH);

// Right-align `right` on the same line as `left`; if the combined length
// would overflow the paper, drop `right` onto its own right-aligned line.
const padLine = (left: string, right: string) => {
  const l = left ?? "";
  const r = right ?? "";
  const space = WIDTH - l.length - r.length;
  if (space >= 1) return l + " ".repeat(space) + r;
  return l + "\n" + " ".repeat(Math.max(0, WIDTH - r.length)) + r;
};

// Word-aware wrap so long product names don't split mid-word.
const wrap = (text: string, width = WIDTH): string[] => {
  const src = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!src) return [""];
  const words = src.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (w.length > width) {
      // hard-split very long single tokens (e.g. SKU codes)
      if (line) {
        lines.push(line);
        line = "";
      }
      let rest = w;
      while (rest.length > width) {
        lines.push(rest.slice(0, width));
        rest = rest.slice(width);
      }
      line = rest;
      continue;
    }
    if (!line) {
      line = w;
    } else if (line.length + 1 + w.length <= width) {
      line += " " + w;
    } else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export type ReceiptItem = {
  name: string;
  qty: number;
  price: number;
  total: number;
};

export type ReceiptData = {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  storeFooter?: string;
  receiptNumber?: string;
  dateTime: string;
  cashier?: string;
  member?: string;
  paymentMethod?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  cash?: number;
  card?: number;
  change?: number;
};

const formatRp = (n: number) =>
  "Rp" + Math.round(Math.abs(n || 0)).toLocaleString("id-ID");

// Build the item block:
//   Product name (wrapped)
//     2 x Rp10.000            Rp20.000
// Qty line is indented 2 spaces; subtotal is right-aligned to WIDTH.
function renderItem(it: ReceiptItem): Uint8Array[] {
  const out: Uint8Array[] = [];
  wrap(it.name).forEach((l) => out.push(enc(l + "\n")));
  const qtyLine = `${it.qty} x ${formatRp(it.price)}`;
  out.push(enc(padLine("  " + qtyLine, formatRp(it.total)) + "\n"));
  return out;
}

function buildReceiptBytes(data: ReceiptData): Uint8Array {
  const parts: Uint8Array[] = [];

  // --- header ---
  parts.push(cmd.init());
  parts.push(cmd.codepage());
  parts.push(cmd.lineSpacingTight());

  parts.push(cmd.alignCenter());
  parts.push(cmd.boldOn());
  parts.push(cmd.doubleSize());
  wrap(data.storeName, Math.floor(WIDTH / 2)).forEach((l) =>
    parts.push(enc(l + "\n"))
  );
  parts.push(cmd.normalSize());
  parts.push(cmd.boldOff());
  if (data.storeAddress)
    wrap(data.storeAddress).forEach((l) => parts.push(enc(l + "\n")));
  if (data.storePhone) parts.push(enc("Telp: " + data.storePhone + "\n"));
  parts.push(enc(SEP + "\n"));

  // --- meta ---
  parts.push(cmd.alignLeft());
  if (data.receiptNumber) parts.push(enc("No   : " + data.receiptNumber + "\n"));
  parts.push(enc("Tgl  : " + data.dateTime + "\n"));
  if (data.cashier) parts.push(enc("Kasir: " + data.cashier + "\n"));
  if (data.member) parts.push(enc("Member: " + data.member + "\n"));
  parts.push(enc(SEP + "\n"));

  // --- items ---
  for (const it of data.items) {
    for (const b of renderItem(it)) parts.push(b);
  }
  parts.push(enc(SEP + "\n"));

  // --- totals (right-aligned amounts) ---
  parts.push(enc(padLine("Subtotal", formatRp(data.subtotal)) + "\n"));
  if (data.discount && data.discount > 0)
    parts.push(enc(padLine("Diskon", "-" + formatRp(data.discount)) + "\n"));
  if (data.tax && data.tax > 0)
    parts.push(enc(padLine("Pajak", formatRp(data.tax)) + "\n"));

  parts.push(cmd.boldOn());
  parts.push(cmd.doubleSize());
  // In double-width mode each printed char is 2 cells, so target WIDTH/2.
  const halfWidth = Math.floor(WIDTH / 2);
  const totalLabel = "TOTAL";
  const totalValue = formatRp(data.total);
  const totalSpace = Math.max(1, halfWidth - totalLabel.length - totalValue.length);
  parts.push(enc(totalLabel + " ".repeat(totalSpace) + totalValue + "\n"));
  parts.push(cmd.normalSize());
  parts.push(cmd.boldOff());

  if (data.paymentMethod)
    parts.push(enc(padLine("Bayar", data.paymentMethod) + "\n"));
  if (data.cash && data.cash > 0)
    parts.push(enc(padLine("Tunai", formatRp(data.cash)) + "\n"));
  if (data.card && data.card > 0)
    parts.push(enc(padLine("Non-Tunai", formatRp(data.card)) + "\n"));
  if (data.change && data.change > 0)
    parts.push(enc(padLine("Kembalian", formatRp(data.change)) + "\n"));

  parts.push(enc(SEP + "\n"));

  // --- footer ---
  parts.push(cmd.alignCenter());
  if (data.storeFooter) {
    data.storeFooter.split("\n").forEach((raw) => {
      wrap(raw).forEach((l) => parts.push(enc(l + "\n")));
    });
  } else {
    parts.push(enc("Terima kasih!\n"));
  }

  // Feed just enough to clear the tear bar, then cut. Saves paper.
  parts.push(cmd.feed(2));
  parts.push(cmd.cut());

  return concat(...parts);
}

export async function printReceipt(data: ReceiptData) {
  await writeChunks(buildReceiptBytes(data));
}

// Test print uses the SAME ESC/POS layout as a real receipt so the user
// sees exactly how a live sale will look on 58mm paper.
export async function printTest(storeName = "KENZHO Apps") {
  const sample: ReceiptData = {
    storeName,
    storeAddress: "Jl. Contoh No. 123, Jakarta",
    storePhone: "0812-3456-7890",
    storeFooter: "Terima kasih!\n-- TES CETAK 58mm --",
    receiptNumber: "TEST-0001",
    dateTime: new Date().toLocaleString("id-ID"),
    cashier: "Tes",
    paymentMethod: "Tunai",
    items: [
      { name: "Kopi Susu Gula Aren Panas Ukuran Large", qty: 2, price: 18000, total: 36000 },
      { name: "Roti Bakar Coklat Keju", qty: 1, price: 15000, total: 15000 },
      { name: "Air Mineral 600ml", qty: 3, price: 5000, total: 15000 },
    ],
    subtotal: 66000,
    discount: 6000,
    total: 60000,
    cash: 100000,
    change: 40000,
  };
  await printReceipt(sample);
}
