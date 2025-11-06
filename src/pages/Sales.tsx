import { useState, useEffect } from "react";
import { Plus, Minus, Trash2, CreditCard, DollarSign, Receipt, Tag, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

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

interface Discount {
  id: string;
  name: string;
  discount_type: string;
  value: number;
  applies_to: string;
  target_id: string | null;
  active: boolean;
}

interface Member {
  id: string;
  name: string;
  member_code: string;
  points: number;
  total_purchases?: number;
}

interface LoyaltyPointRule {
  id: string;
  name: string;
  min_purchase: number;
  points_earned: number;
  applies_to: string;
  target_id: string | null;
  active: boolean;
}

export default function Sales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyPointRule[]>([]);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchProducts();
    fetchDiscounts();
    fetchMembers();
    fetchLoyaltyRules();
  }, []);

  useEffect(() => {
    calculateEarnedPoints();
  }, [selectedMemberId, cart]);

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

  const fetchDiscounts = async () => {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error("Error fetching discounts:", error);
      return;
    }

    setDiscounts(data || []);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('id, name, member_code, points')
      .eq('status', 'active')
      .order('name');

    if (error) {
      console.error("Error fetching members:", error);
      return;
    }

    setMembers(data || []);
  };

  const fetchLoyaltyRules = async () => {
    const { data, error } = await supabase
      .from('loyalty_point_rules')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error("Error fetching loyalty rules:", error);
      return;
    }

    setLoyaltyRules(data || []);
  };

  const calculateEarnedPoints = () => {
    if (!selectedMemberId || cart.length === 0) {
      setEarnedPoints(0);
      return;
    }

    const total = getTotalAmount();
    let totalPoints = 0;

    // Check global rules
    const globalRules = loyaltyRules.filter(rule => 
      rule.applies_to === 'global' && total >= rule.min_purchase
    );
    
    globalRules.forEach(rule => {
      totalPoints += rule.points_earned;
    });

    // Check product-specific rules
    cart.forEach(item => {
      const productRules = loyaltyRules.filter(rule => 
        rule.applies_to === 'product' && 
        rule.target_id === item.product.id &&
        item.subtotal >= rule.min_purchase
      );
      
      productRules.forEach(rule => {
        totalPoints += rule.points_earned;
      });
    });

    setEarnedPoints(totalPoints);
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

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();
    
    if (selectedDiscountId) {
      const discount = discounts.find(d => d.id === selectedDiscountId);
      if (!discount) return 0;

      if (discount.discount_type === "percentage") {
        return (subtotal * discount.value) / 100;
      }
      return discount.value;
    }

    return 0;
  };

  const getTotalAmount = () => {
    return getSubtotal() - getDiscountAmount();
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
      const subtotal = getSubtotal();
      const discountAmount = getDiscountAmount();
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
          subtotal: subtotal,
          total: total,
          discount_total: discountAmount,
          tax_total: 0,
          payment_method: paymentMethod,
          receipt_number: receiptNumber,
          payment_details: {
            amount_paid: paid,
            change: change
          },
          user_id: user?.id || null
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

      // Update member points if member is selected and earned points
      if (selectedMemberId && earnedPoints > 0) {
        const selectedMember = members.find(m => m.id === selectedMemberId);
        if (selectedMember) {
          const { error: memberError } = await supabase
            .from('members')
            .update({ 
              points: (selectedMember.points || 0) + earnedPoints,
              total_purchases: (selectedMember.total_purchases || 0) + total
            })
            .eq('id', selectedMemberId);

          if (memberError) {
            console.error("Error updating member points:", memberError);
          }
        }
      }

      const successMessage = paymentMethod === 'cash' 
        ? `Sale completed! Receipt: ${receiptNumber}\nChange: Rp ${change.toLocaleString()}`
        : `Sale completed! Receipt: ${receiptNumber}`;
      
      const pointsMessage = selectedMemberId && earnedPoints > 0 
        ? `\n\nMember mendapat ${earnedPoints} poin!`
        : '';

      toast({
        title: "Success",
        description: successMessage + pointsMessage,
      });

      clearCart();
      setAmountPaid("");
      setSelectedDiscountId("");
      setSelectedMemberId("");
      setEarnedPoints(0);
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
                  {/* Subtotal */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal:</span>
                    <span className="text-lg font-semibold text-foreground">Rp {getSubtotal().toLocaleString()}</span>
                  </div>

                  {/* Member Section */}
                  <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Member</span>
                    </div>

                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih member (opsional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Bukan member</SelectItem>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name} ({member.member_code}) - {member.points} poin
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedMemberId && selectedMemberId !== "none" && earnedPoints > 0 && (
                      <div className="flex justify-between items-center pt-2 text-success">
                        <span className="text-sm">Poin yang didapat:</span>
                        <span className="font-semibold">+ {earnedPoints} poin</span>
                      </div>
                    )}
                  </div>

                  {/* Discount Section */}
                  <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Diskon</span>
                    </div>

                    <Select value={selectedDiscountId} onValueChange={setSelectedDiscountId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih diskon" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Tidak ada diskon</SelectItem>
                        {discounts.map((discount) => (
                          <SelectItem key={discount.id} value={discount.id}>
                            {discount.name} - {discount.discount_type === "percentage" 
                              ? `${discount.value}%` 
                              : `Rp ${discount.value.toLocaleString()}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {getDiscountAmount() > 0 && (
                      <div className="flex justify-between items-center pt-2 text-success">
                        <span className="text-sm">Potongan:</span>
                        <span className="font-semibold">- Rp {getDiscountAmount().toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-bold text-foreground">Total:</span>
                    <span className="text-2xl font-bold text-primary">Rp {getTotalAmount().toLocaleString()}</span>
                  </div>

                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Rp</span>
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