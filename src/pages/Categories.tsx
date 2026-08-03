import { useState, useEffect } from "react";
import { FolderOpen, Plus, Edit, Trash2, Search, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/contexts/StoreContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CategoryForm } from "@/components/CategoryForm";
import { CategoryProductsDialog } from "@/components/CategoryProductsDialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Category {
  id: number;
  name: string;
  created_at: string;
  product_count?: number;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [productsDialogOpen, setProductsDialogOpen] = useState(false);
  const [viewingCategory, setViewingCategory] = useState<Category | null>(null);
  const { toast } = useToast();
  const { currentStoreId } = useStore();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Fetch categories with product count
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          products(count)
        `)
        .eq('store_id', currentStoreId)
        .order('name', { ascending: true });

      if (error) throw error;

      const categoriesWithCount = data?.map(category => ({
        ...category,
        product_count: category.products?.[0]?.count || 0
      })) || [];

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (categoryId: number) => {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category deleted successfully",
      });

      fetchCategories();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive"
      });
    }
  };

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Categories</h1>
          <p className="text-muted-foreground">Organize your products into categories</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:bg-primary/90"
          onClick={() => {
            setSelectedCategory(null);
            setCategoryFormOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Category
        </Button>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map((category) => (
            <Card key={category.id} className="bg-card border-border hover:shadow-card transition-all duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-foreground flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-primary" />
                    {category.name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Products</span>
                    <Badge variant="secondary" className="text-xs">
                      {category.product_count || 0} items
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(category.created_at).toLocaleDateString()}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setViewingCategory(category);
                        setProductsDialogOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Lihat
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setSelectedCategory(category);
                        setCategoryFormOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-background border-border/50">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{category.name}"? This action cannot be undone.
                            {category.product_count && category.product_count > 0 && (
                              <span className="text-destructive font-medium">
                                <br />Warning: This category has {category.product_count} product(s) assigned to it.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCategory(category.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No Categories Found</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm ? 'No categories match your search.' : 'Get started by creating your first category.'}
            </p>
            <Button 
              className="bg-gradient-primary hover:bg-primary/90"
              onClick={() => {
                setSelectedCategory(null);
                setCategoryFormOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </CardContent>
        </Card>
      )}

      <CategoryForm
        open={categoryFormOpen}
        onOpenChange={setCategoryFormOpen}
        onSuccess={() => {
          fetchCategories();
          setSelectedCategory(null);
        }}
        category={selectedCategory}
      />

      <CategoryProductsDialog
        open={productsDialogOpen}
        onOpenChange={setProductsDialogOpen}
        categoryId={viewingCategory?.id || null}
        categoryName={viewingCategory?.name || ""}
      />
    </div>
  );
}