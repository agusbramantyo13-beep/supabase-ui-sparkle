import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RoleBasedRoute } from "@/components/RoleBasedRoute";
import Index from "./pages/Index";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Users from "./pages/Users";
import Reports from "./pages/Reports";
import TransactionHistory from "./pages/TransactionHistory";
import Attendance from "./pages/Attendance";
import Settings from "./pages/Settings";
import Members from "./pages/Members";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <SidebarProvider defaultOpen={true}>
                    <div className="flex min-h-screen w-full">
                      <AppSidebar />
                      <SidebarInset className="flex-1">
                        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border/50 px-4">
                          <SidebarTrigger className="mr-2" />
                          <div className="flex items-center gap-2">
                            <h1 className="text-lg font-semibold">KENZHO Apps</h1>
                          </div>
                        </header>
                        <main className="flex-1 p-6">
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
                            <Route path="/categories" element={
                              <RoleBasedRoute allowedRoles={["owner"]}>
                                <Categories />
                              </RoleBasedRoute>
                            } />
                            <Route path="/inventory" element={
                              <RoleBasedRoute allowedRoles={["owner"]}>
                                <Inventory />
                              </RoleBasedRoute>
                            } />
                            <Route path="/sales" element={
                              <RoleBasedRoute allowedRoles={["owner", "store_keeper"]}>
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
                              <RoleBasedRoute allowedRoles={["owner", "store_keeper"]}>
                                <TransactionHistory />
                              </RoleBasedRoute>
                            } />
                            <Route path="/attendance" element={
                              <RoleBasedRoute allowedRoles={["owner", "store_keeper"]}>
                                <Attendance />
                              </RoleBasedRoute>
                            } />
                            <Route path="/members" element={
                              <RoleBasedRoute allowedRoles={["owner", "store_keeper"]}>
                                <Members />
                              </RoleBasedRoute>
                            } />
                            <Route path="/settings" element={
                              <RoleBasedRoute allowedRoles={["owner", "store_keeper"]}>
                                <Settings />
                              </RoleBasedRoute>
                            } />
                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </SidebarInset>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;