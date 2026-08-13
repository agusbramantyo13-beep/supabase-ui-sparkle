import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BluetoothPrinterProvider } from "@/contexts/BluetoothPrinterContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StoreRequiredRoute } from "@/components/StoreRequiredRoute";
import { RoleBasedRoute } from "@/components/RoleBasedRoute";
import Index from "./pages/Index";
import Products from "./pages/Products";

import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import TransactionHistory from "./pages/TransactionHistory";
import Attendance from "./pages/Attendance";
import Settings from "./pages/Settings";
import Members from "./pages/Members";
import Discounts from "./pages/Discounts";
import StockAdjustmentReport from "./pages/StockAdjustmentReport";
import StockHistory from "./pages/StockHistory";
import StockTransfer from "./pages/StockTransfer";
import PurchaseReport from "./pages/PurchaseReport";
import StoreSelection from "./pages/StoreSelection";
import CashDeposits from "./pages/CashDeposits";
import StoreExpenses from "./pages/StoreExpenses";
import OtherSales from "./pages/OtherSales";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeProvider>
        <StoreProvider>
          <BluetoothPrinterProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
              <Route path="/select-store" element={
                <ProtectedRoute>
                  <StoreSelection />
                </ProtectedRoute>
              } />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <StoreRequiredRoute>
                      <SidebarProvider defaultOpen={true}>
                        <div className="flex min-h-dvh w-full">
                          <AppSidebar />
                          <SidebarInset className="flex-1 min-w-0">
                            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
                              <SidebarTrigger className="tap-target -ml-1" aria-label="Buka atau tutup menu" />
                              <div className="flex min-w-0 items-center gap-2">
                                <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">KENZHO Apps</h1>
                              </div>
                            </header>
                            <main className="flex-1 p-3 sm:p-4 lg:p-6">

                              <Routes>
                                <Route path="/" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <Index />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/products" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <Products />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/inventory" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <Inventory />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/sales" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <Sales />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/users" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <Users />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/reports" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <Reports />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/transaction-history" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <TransactionHistory />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/attendance" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <Attendance />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/members" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <Members />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/discounts" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <Discounts />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/settings" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <Settings />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/stock-adjustment-report" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <StockAdjustmentReport />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/stock-history" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <StockHistory />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/purchase-report" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <PurchaseReport />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/stock-transfer" element={
                                  <RoleBasedRoute allowedRoles={["owner"]}>
                                    <StockTransfer />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/cash-deposits" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <CashDeposits />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/store-expenses" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <StoreExpenses />
                                  </RoleBasedRoute>
                                } />
                                <Route path="/other-sales" element={
                                  <RoleBasedRoute allowedRoles={["owner", "cashier"]}>
                                    <OtherSales />
                                  </RoleBasedRoute>
                                } />
                                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </main>
                          </SidebarInset>
                        </div>
                      </SidebarProvider>
                    </StoreRequiredRoute>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
          </BluetoothPrinterProvider>
        </StoreProvider>
        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
