import { useState, useEffect, useRef } from "react";
import { Plus, Minus, Trash2, CreditCard, DollarSign, Receipt, Tag, UserCheck, Gift, ChevronDown, ChevronRight, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useStore } from "@/contexts/StoreContext";
import { SplitPaymentInputs } from "@/components/SplitPaymentInputs";
import { MemberCombobox } from "@/components/MemberCombobox";
import { CurrencyKeypadInput } from "@/components/CurrencyKeypadInput";
import { applyInventoryChange } from "@/lib/stockHistory";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";

interface ProductVariant {
  id: string;
  name: string;
  price: number;
  cost_price?: number | null;
  average_cost?: number | null;
  category_name?: string;
  category_id?: string;
  product_id?: string;
  available_stock?: number;
  product_name: string;
  image_path?: string | null;
  product_updated_at?: string | null;
}

interface GroupedProduct {
  product_name: string;
  category_name?: string;
  image_path?: string | null;
  product_updated_at?: string | null;
  variants: ProductVariant[];
}

interface CartItem {
  product: ProductVariant;
  quantity: number;
  subtotal: number;
  isFree?: boolean;
  bundleName?: string;
}

interface BundlePromo {
  id: string;
  name: string;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  bundle_promo_buy_items: { variant_id: number; quantity: number }[];
  bundle_promo_free_items: { variant_id: number; quantity: number }[];
}

interface Discount {
  id: string;
  name: string;
  discount_type: string;
  value: number;
  applies_to: string;
  target_id: string | null;
  active: boolean;
  min_quantity?: number;
  min_purchase?: number;
}

interface Member {
  id: string;
  name: string;
  member_code: string;
  phone?: string | null;
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
  is_multiple?: boolean;
}

interface PointRedemptionRule {
  id: string;
  name: string;
  points_required: number;
  reward_type: string;
  reward_value: number;
  max_discount: number | null;
  min_purchase: number | null;
  active: boolean;
}

export default function Sales() {
  const [products, setProducts] = useState<ProductVariant[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [splitCash, setSplitCash] = useState<string>("");
  const [splitCard, setSplitCard] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [loyaltyRules, setLoyaltyRules] = useState<LoyaltyPointRule[]>([]);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);
  const [redemptionRules, setRedemptionRules] = useState<PointRedemptionRule[]>([]);
  const [selectedRedemptionId, setSelectedRedemptionId] = useState<string>("");
  const [expandedSalesProducts, setExpandedSalesProducts] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [bundlePromos, setBundlePromos] = useState<BundlePromo[]>([]);
  const mobileCartSectionRef = useRef<HTMLDivElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentStoreId } = useStore();

  useEffect(() => {
    fetchProducts();
    fetchDiscounts();
    fetchMembers();
    fetchLoyaltyRules();
    fetchRedemptionRules();
    fetchBundlePromos();
  }, []);

  useEffect(() => {
    calculateEarnedPoints();
  }, [selectedMemberId, cart]);

  useEffect(() => {
    syncBundleFreeItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bundlePromos,
    products,
    // Re-run when paid items change
    cart.filter((c) => !c.isFree).map((c) => `${c.product.id}:${c.quantity}`).join("|"),
  ]);

  useEffect(() => {
    if (mobileCartOpen) {
      requestAnimationFrame(() => {
        mobileCartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [mobileCartOpen]);

  // Reset redemption selection when member changes
  useEffect(() => {
    setSelectedRedemptionId("");
  }, [selectedMemberId]);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('variants')
      .select(`
        id,
        name,
        price,
        cost_price,
        average_cost,
        product_id,
        products!inner(
          id,
          name,
          category_id,
          image_path,
          updated_at,
          categories(id, name)
        )
      `)
      .eq('store_id', currentStoreId);

    if (error) {
      toast({
        title: "Gagal",
        description: "Gagal memuat produk",
        variant: "destructive"
      });
      return;
    }

    // Fetch inventory data
    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('variant_id, quantity')
      .eq('store_id', currentStoreId);

    const inventoryMap = new Map(
      inventoryData?.map(inv => [inv.variant_id, inv.quantity]) || []
    );

    const formattedProducts: ProductVariant[] = data?.map((variant: any) => ({
      id: variant.id.toString(),
      name: variant.name,
      product_name: variant.products.name,
      product_id: variant.products.id?.toString(),
      price: Number(variant.price) || 0,
      cost_price: variant.cost_price != null ? Number(variant.cost_price) : null,
      average_cost: variant.average_cost != null ? Number(variant.average_cost) : null,
      category_name: variant.products.categories?.name,
      category_id: variant.products.categories?.id?.toString() ?? variant.products.category_id?.toString(),
      available_stock: inventoryMap.get(variant.id) || 0,
      image_path: variant.products.image_path ?? null,
      product_updated_at: variant.products.updated_at ?? null,
    })) || [];

    setProducts(formattedProducts);
  };

  const fetchDiscounts = async () => {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('active', true)
      .eq('store_id', currentStoreId);

    if (error) {
      console.error("Error fetching discounts:", error);
      return;
    }

    setDiscounts(data || []);
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('members')
      .select('id, name, member_code, phone, points')
      .eq('status', 'active')
      .eq('store_id', currentStoreId)
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
      .eq('active', true)
      .eq('store_id', currentStoreId);

    if (error) {
      console.error("Error fetching loyalty rules:", error);
      return;
    }

    setLoyaltyRules(data || []);
  };

  const fetchRedemptionRules = async () => {
    const { data, error } = await supabase
      .from('point_redemption_rules')
      .select('*')
      .eq('active', true)
      .eq('store_id', currentStoreId);

    if (error) {
      console.error("Error fetching redemption rules:", error);
      return;
    }

    setRedemptionRules(data || []);
  };

  // Get available redemption rules for selected member
  const getAvailableRedemptions = () => {
    if (!selectedMemberId || selectedMemberId === "none") return [];
    
    const member = members.find(m => m.id === selectedMemberId);
    if (!member) return [];

    const subtotal = getSubtotal();
    
    return redemptionRules.filter(rule => {
      // Check if member has enough points
      if (member.points < rule.points_required) return false;
      // Check minimum purchase requirement
      if (rule.min_purchase && subtotal < rule.min_purchase) return false;
      return true;
    });
  };

  // Calculate redemption discount
  const getRedemptionDiscount = () => {
    if (!selectedRedemptionId || selectedRedemptionId === "none") return 0;
    
    const rule = redemptionRules.find(r => r.id === selectedRedemptionId);
    if (!rule) return 0;

    const subtotal = getSubtotal();
    let discount = 0;

    if (rule.reward_type === "discount_percentage") {
      discount = (subtotal * rule.reward_value) / 100;
      // Apply max discount cap if exists
      if (rule.max_discount && discount > rule.max_discount) {
        discount = rule.max_discount;
      }
    } else if (rule.reward_type === "discount_fixed") {
      discount = rule.reward_value;
    }

    return discount;
  };

  const fetchBundlePromos = async () => {
    const { data, error } = await supabase
      .from("bundle_promos")
      .select(
        "id, name, active, starts_at, ends_at, bundle_promo_buy_items(variant_id, quantity), bundle_promo_free_items(variant_id, quantity)"
      )
      .eq("store_id", currentStoreId);
    if (!error) setBundlePromos((data as any) || []);
  };

  const syncBundleFreeItems = () => {
    const now = new Date();
    const paidItems = cart.filter((c) => !c.isFree);
    const paidQtyMap = new Map<string, number>();
    paidItems.forEach((i) => paidQtyMap.set(i.product.id, (paidQtyMap.get(i.product.id) || 0) + i.quantity));

    // Aggregate target free quantities per variant id
    const targetFreeMap = new Map<string, { qty: number; bundleName: string }>();

    bundlePromos.forEach((bundle) => {
      if (!bundle.active) return;
      if (bundle.starts_at && new Date(bundle.starts_at) > now) return;
      if (bundle.ends_at && new Date(bundle.ends_at) < now) return;

      const buys = bundle.bundle_promo_buy_items || [];
      const frees = bundle.bundle_promo_free_items || [];
      if (buys.length === 0 || frees.length === 0) return;

      // How many full bundles can be applied
      let applies = Infinity;
      for (const b of buys) {
        const have = paidQtyMap.get(String(b.variant_id)) || 0;
        const can = Math.floor(have / (b.quantity || 1));
        if (can < applies) applies = can;
      }
      if (!isFinite(applies) || applies <= 0) return;

      frees.forEach((f) => {
        const key = String(f.variant_id);
        const totalQty = (f.quantity || 1) * applies;
        const prev = targetFreeMap.get(key);
        targetFreeMap.set(key, {
          qty: (prev?.qty || 0) + totalQty,
          bundleName: prev?.bundleName || bundle.name,
        });
      });
    });

    // Reconcile cart's free items with targetFreeMap
    const currentFreeMap = new Map<string, number>();
    cart.filter((c) => c.isFree).forEach((c) => {
      currentFreeMap.set(c.product.id, (currentFreeMap.get(c.product.id) || 0) + c.quantity);
    });

    let changed = false;
    const allKeys = new Set([...targetFreeMap.keys(), ...currentFreeMap.keys()]);
    for (const k of allKeys) {
      if ((targetFreeMap.get(k)?.qty || 0) !== (currentFreeMap.get(k) || 0)) {
        changed = true;
        break;
      }
    }
    if (!changed) return;

    // Rebuild cart: keep non-free items, append free items based on target
    const nonFree = cart.filter((c) => !c.isFree);
    const newFreeItems: CartItem[] = [];
    targetFreeMap.forEach((info, variantId) => {
      const product = products.find((p) => p.id === variantId);
      if (!product) return;
      const cappedQty = Math.min(info.qty, product.available_stock || 0);
      if (cappedQty <= 0) return;
      const freeProduct: ProductVariant = { ...product, price: 0 };
      newFreeItems.push({
        product: freeProduct,
        quantity: cappedQty,
        subtotal: 0,
        isFree: true,
        bundleName: info.bundleName,
      });
    });
    setCart([...nonFree, ...newFreeItems]);
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
      if (rule.is_multiple && rule.min_purchase > 0) {
        const multiplier = Math.floor(total / rule.min_purchase);
        totalPoints += rule.points_earned * multiplier;
      } else {
        totalPoints += rule.points_earned;
      }
    });

    // Check product-specific rules
    cart.forEach(item => {
      const productRules = loyaltyRules.filter(rule => 
        rule.applies_to === 'product' && 
        rule.target_id === item.product.id &&
        item.subtotal >= rule.min_purchase
      );
      
      productRules.forEach(rule => {
        if (rule.is_multiple && rule.min_purchase > 0) {
          const multiplier = Math.floor(item.subtotal / rule.min_purchase);
          totalPoints += rule.points_earned * multiplier;
        } else {
          totalPoints += rule.points_earned;
        }
      });
    });

    setEarnedPoints(totalPoints);
  };

  const addToCart = (product: ProductVariant) => {
    const existingItem = cart.find(item => item.product.id === product.id && !item.isFree);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const freeQty = cart
      .filter(i => i.product.id === product.id && i.isFree)
      .reduce((s, i) => s + i.quantity, 0);
    const availableStock = product.available_stock || 0;

    // Check stock availability (account for reserved free items)
    if (currentQuantity + freeQty >= availableStock) {
      toast({
        title: "Stok Tidak Cukup",
        description: `Stok tersedia: ${availableStock}`,
        variant: "destructive"
      });
      return;
    }

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

    const item = cart.find(i => i.product.id === productId && !i.isFree);
    const availableStock = item?.product.available_stock || 0;
    const freeQty = cart
      .filter(i => i.product.id === productId && i.isFree)
      .reduce((s, i) => s + i.quantity, 0);

    // Check stock availability
    if (newQuantity + freeQty > availableStock) {
      toast({
        title: "Stok Tidak Cukup",
        description: `Stok tersedia: ${availableStock}`,
        variant: "destructive"
      });
      return;
    }

    setCart(cart.map(item =>
      item.product.id === productId && !item.isFree
        ? { ...item, quantity: newQuantity, subtotal: item.product.price * newQuantity }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    // Only remove paid (non-free) entry; free items will re-sync via effect
    setCart(cart.filter(item => !(item.product.id === productId && !item.isFree)));
  };


  const clearCart = () => {
    setCart([]);
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + item.subtotal, 0);
  };

  const getDiscountAmount = () => {
    const subtotal = getSubtotal();

    if (!selectedDiscountId) return 0;
    const discount = discounts.find(d => d.id === selectedDiscountId);
    if (!discount) return 0;

    // Determine the base subtotal and matching qty
    let baseAmount = subtotal;
    let matchingQty = cart.reduce((s, i) => s + i.quantity, 0);

    if (discount.applies_to === 'product' || discount.applies_to === 'category') {
      const targetIds = (discount.target_id || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (targetIds.length === 0) return 0;

      const matching = cart.filter(item =>
        discount.applies_to === 'product'
          ? targetIds.includes(item.product.product_id || '') || targetIds.includes(item.product.id)
          : targetIds.includes(item.product.category_id || '')
      );
      baseAmount = matching.reduce((sum, item) => sum + item.subtotal, 0);
      matchingQty = matching.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Enforce min quantity & min purchase conditions
    const minQty = Number(discount.min_quantity) || 0;
    const minPurchase = Number(discount.min_purchase) || 0;
    if (minQty > 0 && matchingQty < minQty) return 0;
    if (minPurchase > 0 && baseAmount < minPurchase) return 0;

    if (baseAmount <= 0) return 0;

    if (discount.discount_type === "percentage") {
      return (baseAmount * discount.value) / 100;
    }
    return Math.min(discount.value, baseAmount);
  };

  const getTotalAmount = () => {
    return getSubtotal() - getDiscountAmount() - getRedemptionDiscount();
  };

  const getChange = () => {
    const total = getTotalAmount();
    if (paymentMethod === 'split') {
      const paid = (Number(splitCash) || 0) + (Number(splitCard) || 0);
      return paid - total;
    }
    const paid = Number(amountPaid) || 0;
    return paid - total;
  };

  const processSale = async () => {
    if (cart.length === 0) {
      toast({
        title: "Gagal",
        description: "Keranjang kosong",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const selectedMember = members.find(m => m.id === selectedMemberId);
      const subtotal = getSubtotal();
      const discountAmount = getDiscountAmount();
      const total = getTotalAmount();
      const paid = Number(amountPaid) || 0;
      const change = getChange();

      const splitCashNum = Number(splitCash) || 0;
      const splitCardNum = Number(splitCard) || 0;

      if (paymentMethod === 'cash' && paid < total) {
        toast({
          title: "Gagal",
          description: "Jumlah bayar kurang dari total",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      if (paymentMethod === 'split') {
        if (splitCashNum <= 0 || splitCardNum <= 0) {
          toast({
            title: "Gagal",
            description: "Isi jumlah tunai dan kartu untuk pembayaran split",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
        if (splitCashNum + splitCardNum < total) {
          toast({
            title: "Gagal",
            description: "Total tunai + kartu kurang dari total belanja",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
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
            amount_paid: paymentMethod === 'split' ? (splitCashNum + splitCardNum) : paid,
            change: change,
            cash_amount: paymentMethod === 'split' ? splitCashNum : (paymentMethod === 'cash' ? total : 0),
            card_amount: paymentMethod === 'split' ? splitCardNum : (paymentMethod === 'card' ? total : 0),
            member_id: selectedMemberId || null,
            member_name: selectedMember?.name || null
          },
          user_id: user?.id || null,
          store_id: currentStoreId,
          member_id: selectedMemberId || null,
          status: 'completed'
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
        cost_price: item.product.average_cost ?? item.product.cost_price ?? 0,
        total: item.subtotal,
        discount: 0,
        product_snapshot: {
          name: `${item.product.product_name} - ${item.product.name}`,
          price: item.product.price
        }
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Reduce inventory stock (records sale history)
      for (const item of cart) {
        const variantId = Number(item.product.id);
        const { data: currentInventory } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('variant_id', variantId)
          .maybeSingle();

        if (currentInventory) {
          try {
            await applyInventoryChange({
              variantId,
              newQuantity: currentInventory.quantity - item.quantity,
              type: 'sale',
              notes: `Penjualan ${item.quantity}x`,
            });
          } catch (invError) {
            console.error("Error updating inventory:", invError);
          }
        }
      }

      // Calculate points change for member
      let pointsChange = 0;
      let redeemedPointsAmount = 0;
      
      // Deduct points if redemption is used
      if (selectedRedemptionId && selectedRedemptionId !== "none") {
        const redemptionRule = redemptionRules.find(r => r.id === selectedRedemptionId);
        if (redemptionRule) {
          redeemedPointsAmount = redemptionRule.points_required;
          pointsChange -= redeemedPointsAmount;
        }
      }
      
      // Add earned points
      if (earnedPoints > 0) {
        pointsChange += earnedPoints;
      }

      // Update member points if member is selected
      if (selectedMemberId && selectedMemberId !== "none" && pointsChange !== 0) {
        const selectedMember = members.find(m => m.id === selectedMemberId);
        if (selectedMember) {
          const newPoints = Math.max(0, (selectedMember.points || 0) + pointsChange);
          const { error: memberError } = await supabase
            .from('members')
            .update({ 
              points: newPoints,
              total_purchases: (selectedMember.total_purchases || 0) + total
            })
            .eq('id', selectedMemberId);

          if (memberError) {
            console.error("Error updating member points:", memberError);
          }
        }
      }

      const successMessage = paymentMethod === 'cash' 
        ? `Penjualan berhasil! Struk: ${receiptNumber}\nKembalian: Rp ${change.toLocaleString('id-ID')}`
        : `Penjualan berhasil! Struk: ${receiptNumber}`;
      
      let pointsMessage = '';
      if (selectedMemberId && selectedMemberId !== "none") {
        if (redeemedPointsAmount > 0 && earnedPoints > 0) {
          pointsMessage = `\n\nPoin ditukar: -${redeemedPointsAmount} | Poin didapat: +${earnedPoints}`;
        } else if (redeemedPointsAmount > 0) {
          pointsMessage = `\n\nPoin ditukar: -${redeemedPointsAmount}`;
        } else if (earnedPoints > 0) {
          pointsMessage = `\n\nMember mendapat ${earnedPoints} poin!`;
        }
      }

      toast({
        title: "Berhasil",
        description: successMessage + pointsMessage,
      });

      clearCart();
      setAmountPaid("");
      setSplitCash("");
      setSplitCard("");
      setSelectedDiscountId("");
      setSelectedMemberId("");
      setSelectedRedemptionId("");
      setEarnedPoints(0);
      
      // Refresh product list to update stock
      fetchProducts();
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.message || "Gagal memproses penjualan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const availableCategories = Array.from(
    new Set(products.map(p => p.category_name).filter(Boolean) as string[])
  ).sort();

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" || product.category_name === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by product name
  const groupedProducts: GroupedProduct[] = [];
  const groupMap = new Map<string, ProductVariant[]>();
  filteredProducts.forEach(p => {
    const key = p.product_name;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(p);
  });
  groupMap.forEach((variants, product_name) => {
    const sortedVariants = [...variants].sort((a, b) =>
      a.name.localeCompare(b.name, 'id-ID', { numeric: true, sensitivity: 'base' })
    );
    groupedProducts.push({
      product_name,
      category_name: sortedVariants[0]?.category_name,
      image_path: sortedVariants[0]?.image_path,
      product_updated_at: sortedVariants[0]?.product_updated_at,
      variants: sortedVariants
    });
  });


  const toggleSalesExpanded = (productName: string) => {
    setExpandedSalesProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-5 gap-4 pb-24 lg:pb-0">
      {/* Products Section */}

      <div className="space-y-3 lg:col-span-3">
        <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-base font-semibold uppercase tracking-wide text-muted-foreground">Produk</h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:max-w-md w-full">
            <Input
              placeholder="Cari produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Semua kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua kategori</SelectItem>
                {availableCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="lg:max-h-[calc(100dvh-190px)] lg:overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">

            {groupedProducts.map((group) => {
              const hasMultipleVariants = group.variants.length > 1;

              if (!hasMultipleVariants) {
                const variant = group.variants[0];
                const stock = variant.available_stock || 0;
                return (
                  <Card
                    key={variant.id}
                    className="group cursor-pointer hover:shadow-card hover:border-primary/50 transition-all bg-card overflow-hidden flex flex-col"
                    onClick={() => addToCart(variant)}
                  >
                    <div className="relative aspect-square">
                      <ProductImage
                        imagePath={group.image_path}
                        updatedAt={group.product_updated_at}
                        alt={group.product_name}
                        className="w-full h-full"
                      />
                      <Badge
                        variant={stock > 0 ? "secondary" : "destructive"}
                        className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0"
                      >
                        {stock > 0 ? `Stok ${stock}` : "Habis"}
                      </Badge>
                    </div>
                    <CardContent className="p-2.5 flex flex-col gap-1 flex-1">
                      <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
                        {group.product_name}
                      </h3>
                      <div className="flex items-end justify-between gap-1 mt-auto pt-1">
                        <p className="text-sm font-semibold text-primary [font-variant-numeric:tabular-nums]">
                          Rp {variant.price.toLocaleString('id-ID')}
                        </p>
                        <Button
                          size="icon"
                          className="h-7 w-7 shrink-0 bg-gradient-primary"
                          onClick={(e) => { e.stopPropagation(); addToCart(variant); }}
                          aria-label="Tambah ke keranjang"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // Multiple variants: card triggers variant picker (expand inline below card row)
              const isExpanded = expandedSalesProducts.has(group.product_name);
              return (
                <Card
                  key={group.product_name}
                  className={cn(
                    "group cursor-pointer hover:shadow-card hover:border-primary/50 transition-all bg-card overflow-hidden flex flex-col",
                    isExpanded && "col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-3 xl:col-span-4"
                  )}
                >
                  {!isExpanded ? (
                    <div onClick={() => toggleSalesExpanded(group.product_name)}>
                      <div className="relative aspect-square">
                        <ProductImage
                          imagePath={group.image_path}
                          updatedAt={group.product_updated_at}
                          alt={group.product_name}
                          className="w-full h-full"
                        />
                        <Badge variant="outline" className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0 bg-background/90">
                          {group.variants.length} varian
                        </Badge>
                      </div>
                      <CardContent className="p-2.5 flex flex-col gap-1">
                        <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-tight">
                          {group.product_name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Mulai Rp {Math.min(...group.variants.map(v => v.price)).toLocaleString('id-ID')}
                        </p>
                      </CardContent>
                    </div>
                  ) : (
                    <div>
                      <div
                        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleSalesExpanded(group.product_name)}
                      >
                        <ProductImage
                          imagePath={group.image_path}
                          updatedAt={group.product_updated_at}
                          alt={group.product_name}
                          className="w-14 h-14 rounded-md shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground truncate">{group.product_name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {group.category_name} · {group.variants.length} varian
                          </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="border-t border-border/50 grid grid-cols-1 sm:grid-cols-2">
                        {group.variants.map((variant) => {
                          const stock = variant.available_stock || 0;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              className="flex items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-b-0 sm:border-r sm:last:border-r-0"
                              onClick={() => addToCart(variant)}
                            >
                              <div className="min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">{variant.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Rp {variant.price.toLocaleString('id-ID')} · Stok {stock}
                                </p>
                              </div>
                              <Plus className="w-4 h-4 text-primary shrink-0 ml-2" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

      </div>

      {/* Cart Section - Mobile */}
      {mobileCartOpen && (
        <div ref={mobileCartSectionRef} className="lg:hidden space-y-4 scroll-mt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Keranjang</h2>
              <p className="text-sm text-muted-foreground">{totalCartItems} item</p>
            </div>
            <div className="flex items-center gap-2">
              {cart.length > 0 && (
                <Button variant="outline" size="sm" onClick={clearCart}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Hapus Semua
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMobileCartOpen(false)}
                aria-label="Tutup keranjang"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Card className="bg-card">
            <CardContent className="p-4 flex flex-col">
              {cart.length === 0 ? (
                <div className="py-12 flex items-center justify-center text-center">
                  <div>
                    <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Keranjang kosong</p>
                    <p className="text-sm text-muted-foreground">Tambahkan produk untuk memulai penjualan</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pb-2">
                  {cart.map((item, idx) => (
                    <div key={`${item.isFree ? 'free' : 'paid'}-${item.product.id}-${idx}`} className={`p-3 rounded-lg space-y-2 ${item.isFree ? 'bg-success/10 border border-success/30' : 'bg-muted/20'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-foreground text-sm break-words">{item.product.product_name} - {item.product.name}</h4>
                            {item.isFree && <Badge variant="default" className="bg-success text-success-foreground text-[10px]">GRATIS</Badge>}
                          </div>
                          {item.isFree ? (
                            <p className="text-xs text-success">Promo: {item.bundleName}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Rp {item.product.price.toLocaleString('id-ID')} /pcs</p>
                          )}
                        </div>
                        <p className="font-semibold text-foreground text-sm whitespace-nowrap">Rp {item.subtotal.toLocaleString('id-ID')}</p>
                      </div>
                      {!item.isFree && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="font-medium w-8 text-center">{item.quantity}</span>
                            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => removeFromCart(item.product.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {item.isFree && (
                        <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                      )}
                    </div>
                  ))}


                  <Separator className="my-2" />

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal:</span>
                    <span className="text-lg font-semibold text-foreground">Rp {getSubtotal().toLocaleString('id-ID')}</span>
                  </div>

                  <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Member</span>
                    </div>
                    <MemberCombobox
                      members={members}
                      value={selectedMemberId}
                      onChange={setSelectedMemberId}
                    />
                    {selectedMemberId && selectedMemberId !== "none" && earnedPoints > 0 && (
                      <div className="flex justify-between items-center pt-2 text-success">
                        <span className="text-sm">Poin yang didapat:</span>
                        <span className="font-semibold">+ {earnedPoints} poin</span>
                      </div>
                    )}
                  </div>

                  {selectedMemberId && selectedMemberId !== "none" && (
                    <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Redeem Poin</span>
                      </div>
                      <Select value={selectedRedemptionId} onValueChange={setSelectedRedemptionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih promo redeem (opsional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tidak redeem poin</SelectItem>
                          {getAvailableRedemptions().map((rule) => (
                            <SelectItem key={rule.id} value={rule.id}>
                              {rule.name} - {rule.points_required} poin = {
                                rule.reward_type === "discount_percentage"
                                  ? `Diskon ${rule.reward_value}%${rule.max_discount ? ` (max Rp ${rule.max_discount.toLocaleString('id-ID')})` : ''}`
                                  : `Rp ${rule.reward_value.toLocaleString('id-ID')}`
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {getRedemptionDiscount() > 0 && (
                        <div className="flex justify-between items-center pt-2 text-success">
                          <span className="text-sm">Potongan Redeem:</span>
                          <span className="font-semibold">- Rp {getRedemptionDiscount().toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  )}

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
                              : `Rp ${discount.value.toLocaleString('id-ID')}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {getDiscountAmount() > 0 && (
                      <div className="flex justify-between items-center pt-2 text-success">
                        <span className="text-sm">Potongan:</span>
                        <span className="font-semibold">- Rp {getDiscountAmount().toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-bold text-foreground">Total:</span>
                    <span className="num text-2xl font-semibold text-primary">Rp {getTotalAmount().toLocaleString('id-ID')}</span>
                  </div>

                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Rp</span>
                          Tunai
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Kartu
                        </div>
                      </SelectItem>
                      <SelectItem value="split">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Split (Tunai + Kartu)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {paymentMethod === 'cash' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Jumlah Dibayar</label>
                        <CurrencyKeypadInput
                          value={amountPaid}
                          onChange={setAmountPaid}
                          label="Jumlah Dibayar"
                          placeholder="0"
                          targetAmount={getTotalAmount()}
                        />
                      </div>
                      {amountPaid && Number(amountPaid) >= getTotalAmount() && (
                        <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                          <span className="text-sm font-semibold text-success">Kembalian:</span>
                          <span className="text-xl font-bold text-success">Rp {getChange().toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </>
                  )}

                  {paymentMethod === 'split' && (
                    <SplitPaymentInputs
                      total={getTotalAmount()}
                      splitCash={splitCash}
                      splitCard={splitCard}
                      setSplitCash={setSplitCash}
                      setSplitCard={setSplitCard}
                    />
                  )}

                  <Button
                    className="w-full bg-gradient-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg"
                    onClick={async () => { const before = cart.length; await processSale(); if (before > 0) setMobileCartOpen(false); }}
                    disabled={loading}
                  >
                    {loading ? "Memproses..." : "Selesaikan Penjualan"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cart Section - Desktop only */}
      <div className="hidden lg:block space-y-3 lg:col-span-2">
        <div className="flex items-center justify-between py-2">
          <h2 className="text-base font-semibold uppercase tracking-wide text-muted-foreground">Keranjang</h2>
          {cart.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearCart}>
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus Semua
            </Button>
          )}
        </div>

        <Card className="bg-card lg:h-[calc(100dvh-190px)] flex flex-col">
          <CardContent className="p-4 sm:p-6 flex-1 flex flex-col">
            {cart.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keranjang kosong</p>
                  <p className="text-sm text-muted-foreground">Tambahkan produk untuk memulai penjualan</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[50vh] lg:max-h-none">
                  {cart.map((item, idx) => (
                    <div key={`${item.isFree ? 'free' : 'paid'}-${item.product.id}-${idx}`} className={`p-3 rounded-lg space-y-2 ${item.isFree ? 'bg-success/10 border border-success/30' : 'bg-muted/20'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium text-foreground text-sm sm:text-base break-words">{item.product.product_name} - {item.product.name}</h4>
                            {item.isFree && <Badge variant="default" className="bg-success text-success-foreground text-[10px]">GRATIS</Badge>}
                          </div>
                          {item.isFree ? (
                            <p className="text-xs sm:text-sm text-success">Promo: {item.bundleName}</p>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground">Rp {item.product.price.toLocaleString('id-ID')} /pcs</p>
                          )}
                        </div>
                        <p className="font-semibold text-foreground text-sm sm:text-base whitespace-nowrap">Rp {item.subtotal.toLocaleString('id-ID')}</p>
                      </div>

                      {!item.isFree ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>

                            <span className="font-medium w-8 text-center">{item.quantity}</span>

                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Qty: {item.quantity}</div>
                      )}
                    </div>
                  ))}

                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  {/* Subtotal */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal:</span>
                    <span className="text-lg font-semibold text-foreground">Rp {getSubtotal().toLocaleString('id-ID')}</span>
                  </div>

                  {/* Member Section */}
                  <div className="space-y-2 p-3 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">Member</span>
                    </div>

                    <MemberCombobox
                      members={members}
                      value={selectedMemberId}
                      onChange={setSelectedMemberId}
                    />

                    {selectedMemberId && selectedMemberId !== "none" && earnedPoints > 0 && (
                      <div className="flex justify-between items-center pt-2 text-success">
                        <span className="text-sm">Poin yang didapat:</span>
                        <span className="font-semibold">+ {earnedPoints} poin</span>
                      </div>
                    )}
                  </div>

                  {/* Point Redemption Section - Only show when member is selected */}
                  {selectedMemberId && selectedMemberId !== "none" && (
                    <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">Redeem Poin</span>
                      </div>

                      <Select 
                        value={selectedRedemptionId} 
                        onValueChange={setSelectedRedemptionId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih promo redeem (opsional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tidak redeem poin</SelectItem>
                          {getAvailableRedemptions().map((rule) => (
                            <SelectItem key={rule.id} value={rule.id}>
                              {rule.name} - {rule.points_required} poin = {
                                rule.reward_type === "discount_percentage" 
                                  ? `Diskon ${rule.reward_value}%${rule.max_discount ? ` (max Rp ${rule.max_discount.toLocaleString('id-ID')})` : ''}`
                                  : `Rp ${rule.reward_value.toLocaleString('id-ID')}`
                              }
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {getAvailableRedemptions().length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Tidak ada promo yang tersedia (poin tidak cukup atau belum memenuhi syarat)
                        </p>
                      )}

                      {getRedemptionDiscount() > 0 && (
                        <div className="flex justify-between items-center pt-2 text-success">
                          <span className="text-sm">Potongan Redeem:</span>
                          <span className="font-semibold">- Rp {getRedemptionDiscount().toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </div>
                  )}

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
                              : `Rp ${discount.value.toLocaleString('id-ID')}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {getDiscountAmount() > 0 && (
                      <div className="flex justify-between items-center pt-2 text-success">
                        <span className="text-sm">Potongan:</span>
                        <span className="font-semibold">- Rp {getDiscountAmount().toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-lg font-bold text-foreground">Total:</span>
                    <span className="num text-2xl font-semibold text-primary">Rp {getTotalAmount().toLocaleString('id-ID')}</span>
                  </div>

                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Rp</span>
                          Tunai
                        </div>
                      </SelectItem>
                      <SelectItem value="card">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Kartu
                        </div>
                      </SelectItem>
                      <SelectItem value="split">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          Split (Tunai + Kartu)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {paymentMethod === 'cash' && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">Jumlah Dibayar</label>
                        <CurrencyKeypadInput
                          value={amountPaid}
                          onChange={setAmountPaid}
                          label="Jumlah Dibayar"
                          placeholder="0"
                          targetAmount={getTotalAmount()}
                        />
                      </div>

                      {amountPaid && Number(amountPaid) >= getTotalAmount() && (
                        <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                          <span className="text-sm font-semibold text-success">Kembalian:</span>
                          <span className="text-xl font-bold text-success">Rp {getChange().toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </>
                  )}

                  {paymentMethod === 'split' && (
                    <SplitPaymentInputs
                      total={getTotalAmount()}
                      splitCash={splitCash}
                      splitCard={splitCard}
                      setSplitCash={setSplitCash}
                      setSplitCard={setSplitCard}
                    />
                  )}

                  <Button 
                    className="w-full bg-gradient-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6 text-lg"
                    onClick={processSale}
                    disabled={loading}
                  >
                    {loading ? "Memproses..." : "Selesaikan Penjualan"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mobile floating cart bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border shadow-elegant">
        <button
          type="button"
          onClick={() => setMobileCartOpen((open) => !open)}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-primary text-primary-foreground font-semibold py-4 text-lg active:opacity-90 transition-opacity"
        >
          <span>Rp {getTotalAmount().toLocaleString('id-ID')}</span>
          {totalCartItems > 0 && (
            <span className="text-xs font-medium opacity-90">({totalCartItems} item)</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobileCartOpen((open) => !open)}
          className="relative bg-primary text-primary-foreground px-6 flex items-center justify-center border-l border-primary-foreground/20 active:opacity-90 transition-opacity"
          aria-label="Buka keranjang"
        >
          <ShoppingCart className="w-6 h-6" />
          {totalCartItems > 0 && (
            <span className="absolute top-1.5 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {totalCartItems}
            </span>
          )}
        </button>
      </div>

    </div>
  );
}