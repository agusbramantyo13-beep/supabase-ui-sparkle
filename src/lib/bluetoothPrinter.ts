// ESC/POS Bluetooth printer utility for thermal receipt printers.
// Works with Web Bluetooth API (Chrome on Android, Chrome/Edge on desktop, HTTPS only).

// Common Serial Port Profile (SPP-like GATT) UUIDs used by generic ESC/POS
// thermal printers (e.g. Xprinter, Goojprt, RPP02N, MTP-II, etc.)
const PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // most common
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
    // Show any device, then we sniff for a writable characteristic
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
  // BLE MTU is small — write in chunks
  const CHUNK = 180;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.slice(i, i + CHUNK);
    if (char.properties?.writeWithoutResponse) {
      await char.writeValueWithoutResponse(slice);
    } else {
      await char.writeValue(slice);
    }
    // small delay for slow printers
    await new Promise((r) => setTimeout(r, 20));
  }
}

// ESC/POS helpers
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const enc = (s: string) => new TextEncoder().encode(s);

const cmd = {
  init: () => new Uint8Array([ESC, 0x40]),
  alignLeft: () => new Uint8Array([ESC, 0x61, 0]),
  alignCenter: () => new Uint8Array([ESC, 0x61, 1]),
  alignRight: () => new Uint8Array([ESC, 0x61, 2]),
  boldOn: () => new Uint8Array([ESC, 0x45, 1]),
  boldOff: () => new Uint8Array([ESC, 0x45, 0]),
  doubleSize: () => new Uint8Array([GS, 0x21, 0x11]),
  normalSize: () => new Uint8Array([GS, 0x21, 0x00]),
  cut: () => new Uint8Array([GS, 0x56, 0x42, 0x00]),
  feed: (n = 3) => new Uint8Array([ESC, 0x64, n]),
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

const WIDTH = 32; // 58mm paper ~ 32 chars; adjust to 48 for 80mm

const padLine = (left: string, right: string) => {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + " ".repeat(space) + right;
};

const wrap = (text: string, width = WIDTH) => {
  const lines: string[] = [];
  let s = text;
  while (s.length > width) {
    lines.push(s.slice(0, width));
    s = s.slice(width);
  }
  if (s.length) lines.push(s);
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

export async function printReceipt(data: ReceiptData) {
  const parts: Uint8Array[] = [];
  parts.push(cmd.init());
  parts.push(cmd.alignCenter());
  parts.push(cmd.boldOn());
  parts.push(cmd.doubleSize());
  parts.push(enc(data.storeName + "\n"));
  parts.push(cmd.normalSize());
  parts.push(cmd.boldOff());
  if (data.storeAddress)
    wrap(data.storeAddress).forEach((l) => parts.push(enc(l + "\n")));
  if (data.storePhone) parts.push(enc("Telp: " + data.storePhone + "\n"));
  parts.push(enc("-".repeat(WIDTH) + "\n"));
  parts.push(cmd.alignLeft());
  if (data.receiptNumber) parts.push(enc("No: " + data.receiptNumber + "\n"));
  parts.push(enc("Tgl: " + data.dateTime + "\n"));
  if (data.cashier) parts.push(enc("Kasir: " + data.cashier + "\n"));
  if (data.member) parts.push(enc("Member: " + data.member + "\n"));
  parts.push(enc("-".repeat(WIDTH) + "\n"));

  for (const it of data.items) {
    wrap(it.name).forEach((l) => parts.push(enc(l + "\n")));
    const qtyLine = `${it.qty} x ${formatRp(it.price)}`;
    parts.push(enc(padLine("  " + qtyLine, formatRp(it.total)) + "\n"));
  }
  parts.push(enc("-".repeat(WIDTH) + "\n"));
  parts.push(enc(padLine("Subtotal", formatRp(data.subtotal)) + "\n"));
  if (data.discount && data.discount > 0)
    parts.push(enc(padLine("Diskon", "-" + formatRp(data.discount)) + "\n"));
  if (data.tax && data.tax > 0)
    parts.push(enc(padLine("Pajak", formatRp(data.tax)) + "\n"));
  parts.push(cmd.boldOn());
  parts.push(enc(padLine("TOTAL", formatRp(data.total)) + "\n"));
  parts.push(cmd.boldOff());
  if (data.paymentMethod)
    parts.push(enc(padLine("Bayar", data.paymentMethod) + "\n"));
  if (data.cash && data.cash > 0)
    parts.push(enc(padLine("Tunai", formatRp(data.cash)) + "\n"));
  if (data.card && data.card > 0)
    parts.push(enc(padLine("Non-Tunai", formatRp(data.card)) + "\n"));
  if (data.change && data.change > 0)
    parts.push(enc(padLine("Kembalian", formatRp(data.change)) + "\n"));

  parts.push(enc("-".repeat(WIDTH) + "\n"));
  parts.push(cmd.alignCenter());
  if (data.storeFooter)
    wrap(data.storeFooter).forEach((l) => parts.push(enc(l + "\n")));
  else parts.push(enc("Terima kasih!\n"));
  parts.push(cmd.feed(3));
  parts.push(cmd.cut());

  await writeChunks(concat(...parts));
}

export async function printTest(storeName = "KENZHO Apps") {
  const parts = concat(
    cmd.init(),
    cmd.alignCenter(),
    cmd.boldOn(),
    cmd.doubleSize(),
    enc(storeName + "\n"),
    cmd.normalSize(),
    cmd.boldOff(),
    enc("Tes Cetak Berhasil\n"),
    enc(new Date().toLocaleString("id-ID") + "\n"),
    enc("-".repeat(WIDTH) + "\n"),
    cmd.alignLeft(),
    enc("Printer Bluetooth terhubung\n"),
    enc("dan siap digunakan.\n"),
    cmd.feed(3),
    cmd.cut()
  );
  await writeChunks(parts);
}
