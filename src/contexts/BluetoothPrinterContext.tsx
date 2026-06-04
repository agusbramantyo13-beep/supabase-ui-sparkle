import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  connectPrinter as doConnect,
  disconnectPrinter as doDisconnect,
  getSavedPrinterName,
  isWebBluetoothSupported,
  printReceipt as doPrintReceipt,
  printTest as doPrintTest,
  ReceiptData,
} from "@/lib/bluetoothPrinter";

interface Ctx {
  supported: boolean;
  connected: boolean;
  deviceName: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  printReceipt: (d: ReceiptData) => Promise<void>;
  printTest: (storeName?: string) => Promise<void>;
}

const BluetoothPrinterContext = createContext<Ctx | null>(null);

export function BluetoothPrinterProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(getSavedPrinterName());
  const supported = isWebBluetoothSupported();

  const connect = async () => {
    const p = await doConnect();
    setConnected(true);
    setDeviceName(p.device.name || "Printer Bluetooth");
    p.device.addEventListener("gattserverdisconnected", () => setConnected(false));
  };

  const disconnect = () => {
    doDisconnect();
    setConnected(false);
    setDeviceName(null);
  };

  useEffect(() => {
    // Check if already connected on mount
    const saved = getSavedPrinterName();
    if (saved) {
      setDeviceName(saved);
    }
  }, []);

  return (
    <BluetoothPrinterContext.Provider
      value={{
        supported,
        connected,
        deviceName,
        connect,
        disconnect,
        printReceipt: doPrintReceipt,
        printTest: doPrintTest,
      }}
    >
      {children}
    </BluetoothPrinterContext.Provider>
  );
}

export function useBluetoothPrinter() {
  const ctx = useContext(BluetoothPrinterContext);
  if (!ctx) throw new Error("useBluetoothPrinter must be used inside BluetoothPrinterProvider");
  return ctx;
}
