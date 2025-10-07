import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, CreditCard, DollarSign, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  category_name?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('variants')
      .select(`
        id,
        name,
        price,
        products!inner(
          name,
          categories(name)
        )
      `);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive"
      });
      return;
    }

    const formattedProducts = data?.map(variant => ({
      id: variant.id.toString(),
      name: `${variant.products.name} - ${variant.name}`,
      price: Number(variant.price) || 0,
      category_name: variant.products.categories?.name
    })) || [];

    setProducts(formattedProducts);
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      updateQuantity(product.id, existingItem.quantity + 1);
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        subtotal: product.price
      }]);
    }
  };

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: newQuantity, subtotal: item.product.price * newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const getChange = () => {
    const paid = Number(amountPaid) || 0;
    const total = getTotalAmount();
    return paid - total;
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Error",
        description: "Cart is empty",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const total = getTotalAmount();
      const paid = Number(amountPaid) || 0;
      const change = getChange();

      if (paymentMethod === 'cash' && paid < total) {
        toast({
          title: "Error",
          description: "Amount paid is less than total",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const receiptNumber = `RCP-${Date.now()}`;

      // Create sale record
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert({
          subtotal: total,
          total: total,
          discount_total: 0,
          tax_total: 0,
          payment_method: paymentMethod,
          receipt_number: receiptNumber,
          payment_details: {
            amount_paid: paid,
            change: change
          },
          user_id: null // Would be current user in real app
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = cart.map(item => ({
        sale_id: saleData.id,
        variant_id: Number(item.product.id),
        quantity: item.quantity,
        unit_price: item.product.price,
        cost_price: item.product.price * 0.6, // Estimated cost
        total: item.subtotal,
        discount: 0,
        product_snapshot: {
          name: item.product.name,
          price: item.product.price
        }
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Success",
        description: paymentMethod === 'cash' 
          ? `Sale completed! Receipt: ${receiptNumber}\nChange: Rp ${change.toLocaleString()}`
          : `Sale completed! Receipt: ${receiptNumber}`,
      });

      clearCart();
      setAmountPaid("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process sale",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Products</h2>
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id} 
              className="cursor-pointer hover:shadow-card transition-shadow bg-gradient-card"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-4">
                <h3 className="font-semibold text-foreground truncate">{product.name}</h3>
                <p className="text-sm text-muted-foreground">{product.category_name}</p>
                <p className="text-lg font-bold text-primary mt-2">Rp {product.price.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Cart</h2>
          {cart.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearCart}>
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>

        <Card className="bg-gradient-card h-[calc(100vh-200px)] flex flex-col">
          <CardContent className="p-6 flex-1 flex flex-col">
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Cart is empty</p>
                  <p className="text-sm text-muted-foreground">Add products to start a sale</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground">{item.product.name}</h4>
                        <p className="text-sm text-muted-foreground">Rp {item.product.price.toLocaleString()} each</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        
                        <span className="font-medium w-8 text-center">{item.quantity}</span>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeFromCart(item.product.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="font-semibold text-foreground">Rp {item.subtotal.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-foreground">Total:</span>
                    <span className="text-2xl font-bold text-primary">Rp {getTotalAmount().toLocaleString()}</span>
                  </div>

                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Cash
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Card
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {paymentMethod === 'cash' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Amount Paid</label>
                        <Input
                          type="number"
                          placeholder="Enter amount paid"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className="text-lg"
                        />
                      </div>

                      {amountPaid && Number(amountPaid) >= getTotalAmount() && (
                        <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                          <span className="text-sm font-semibold text-success">Change:</span>
                          <span className="text-xl font-bold text-success">Rp {getChange().toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}

                  <Button 
                    className="w-full bg-gradient-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg"
                    onClick={processSale}
                    disabled={loading}
                  >
                    {loading ? "Processing..." : "Complete Sale"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}