import React, { createContext, useContext, useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { ShoppingBag, User, Menu, X, Plus, Minus, Trash2, ChevronRight, Package, LogOut, Settings, LayoutDashboard, ExternalLink } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// PayPal Client ID - sandbox for testing
const PAYPAL_CLIENT_ID = "sb";

// Configure axios
axios.defaults.withCredentials = true;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${API}/auth/me`);
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    setUser(res.data);
    return res.data;
  };

  const register = async (email, password, name) => {
    const res = await axios.post(`${API}/auth/register`, { email, password, name });
    setUser(res.data);
    return res.data;
  };

  const logout = async () => {
    await axios.post(`${API}/auth/logout`);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Cart Context
const CartContext = createContext(null);

export const useCart = () => useContext(CartContext);

const CartProvider = ({ children }) => {
  const [cart, setCart] = useState({ items: [], total: 0 });
  const [cartLoading, setCartLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchCart();
    } else {
      setCart({ items: [], total: 0 });
    }
  }, [user]);

  const fetchCart = async () => {
    try {
      const res = await axios.get(`${API}/cart`);
      setCart(res.data);
    } catch {
      setCart({ items: [], total: 0 });
    }
  };

  const addToCart = async (productId, quantity, size) => {
    setCartLoading(true);
    try {
      await axios.post(`${API}/cart/add`, { product_id: productId, quantity, size });
      await fetchCart();
      toast.success("Added to cart");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add to cart");
    } finally {
      setCartLoading(false);
    }
  };

  const updateQuantity = async (productId, quantity) => {
    try {
      await axios.put(`${API}/cart/${productId}`, { quantity });
      await fetchCart();
    } catch {
      toast.error("Failed to update cart");
    }
  };

  const removeFromCart = async (productId) => {
    try {
      await axios.delete(`${API}/cart/${productId}`);
      await fetchCart();
      toast.success("Removed from cart");
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const clearCart = async () => {
    try {
      await axios.delete(`${API}/cart`);
      setCart({ items: [], total: 0 });
    } catch {
      console.error("Failed to clear cart");
    }
  };

  return (
    <CartContext.Provider value={{ cart, cartLoading, addToCart, updateQuantity, removeFromCart, clearCart, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Header Component
const Header = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const cartCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className="header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <Link to="/" className="flex-shrink-0" data-testid="logo-link">
            <img 
              src="https://customer-assets.emergentagent.com/job_d516ffd1-874f-4457-90ac-2910d6277886/artifacts/hqumdoqf_a1c68d89-a2d2-4d0b-a443-d396cf7473d0%20%281%29.png"
              alt="SEVYN"
              className="h-8 sm:h-10 w-auto"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/shop" className="text-sm uppercase tracking-widest text-gray-400 hover:text-white transition-colors font-mono" data-testid="nav-shop">
              Shop
            </Link>
            {user?.role === "admin" && (
              <Link to="/admin" className="text-sm uppercase tracking-widest text-gray-400 hover:text-white transition-colors font-mono" data-testid="nav-admin">
                Admin
              </Link>
            )}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            <Link to="/cart" className="relative p-2 hover:bg-white/5 transition-colors" data-testid="cart-link">
              <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="cart-badge" data-testid="cart-count">{cartCount}</span>
              )}
            </Link>

            {user ? (
              <Link to="/account" className="p-2 hover:bg-white/5 transition-colors" data-testid="account-link">
                <User className="w-5 h-5" strokeWidth={1.5} />
              </Link>
            ) : (
              <Link to="/login" className="btn-secondary text-xs py-2 px-4" data-testid="login-link">
                Login
              </Link>
            )}

            <button 
              className="md:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="mobile-menu-toggle"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="mobile-menu md:hidden">
          <nav className="flex flex-col space-y-6">
            <Link 
              to="/shop" 
              className="text-2xl uppercase tracking-widest"
              onClick={() => setMenuOpen(false)}
              data-testid="mobile-nav-shop"
            >
              Shop
            </Link>
            {user?.role === "admin" && (
              <Link 
                to="/admin" 
                className="text-2xl uppercase tracking-widest"
                onClick={() => setMenuOpen(false)}
                data-testid="mobile-nav-admin"
              >
                Admin
              </Link>
            )}
            {user ? (
              <>
                <Link 
                  to="/account" 
                  className="text-2xl uppercase tracking-widest"
                  onClick={() => setMenuOpen(false)}
                  data-testid="mobile-nav-account"
                >
                  Account
                </Link>
                <button 
                  onClick={() => { logout(); setMenuOpen(false); }}
                  className="text-2xl uppercase tracking-widest text-left text-gray-400"
                  data-testid="mobile-logout"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link 
                to="/login" 
                className="text-2xl uppercase tracking-widest"
                onClick={() => setMenuOpen(false)}
                data-testid="mobile-nav-login"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
};

// Footer Component
const Footer = () => (
  <footer className="footer">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row items-center justify-between">
        <img 
          src="https://customer-assets.emergentagent.com/job_d516ffd1-874f-4457-90ac-2910d6277886/artifacts/hqumdoqf_a1c68d89-a2d2-4d0b-a443-d396cf7473d0%20%281%29.png"
          alt="SEVYN"
          className="h-6 w-auto mb-4 md:mb-0"
        />
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">
          © 2024 SEVYN. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

// Home Page
const Home = () => {
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API}/products`);
      setProducts(res.data.slice(0, 4));
    } catch {
      console.error("Failed to fetch products");
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="hero-section relative">
        <div className="hero-bg" />
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url('https://customer-assets.emergentagent.com/job_d516ffd1-874f-4457-90ac-2910d6277886/artifacts/g5b4v8cx_6a901dca-b758-45fa-9146-bc00943e433d.png')`,
            backgroundSize: '500px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            mixBlendMode: 'screen'
          }}
        />
        <div className="relative z-10 text-center px-4 fade-in">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-gray-500 mb-4">
            Gothic • Tribal • Chrome
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black tracking-tighter mb-6">
            SEVYN
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-md mx-auto mb-8">
            Exclusive streetwear with a dark edge. Limited drops. No compromises.
          </p>
          <button 
            onClick={() => navigate("/shop")}
            className="btn-primary"
            data-testid="shop-now-btn"
          >
            Shop Now
          </button>
        </div>
      </section>

      {/* Featured Products */}
      {products.length > 0 && (
        <section className="py-16 sm:py-24 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-12">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Latest Drops
              </h2>
              <Link 
                to="/shop" 
                className="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-white flex items-center gap-2"
                data-testid="view-all-link"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#262626]">
              {products.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 sm:py-24 border-t border-[#262626]">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Join The Movement
          </h2>
          <p className="text-gray-400 mb-8 max-w-lg mx-auto">
            Get exclusive access to new drops, limited editions, and members-only deals.
          </p>
          <button 
            onClick={() => navigate("/register")}
            className="btn-secondary"
            data-testid="join-btn"
          >
            Create Account
          </button>
        </div>
      </section>
    </div>
  );
};

// Product Card Component
const ProductCard = ({ product, index }) => {
  const navigate = useNavigate();
  
  return (
    <div 
      className="product-card bg-black p-4 sm:p-6 cursor-pointer fade-in"
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={() => navigate(`/product/${product.id}`)}
      data-testid={`product-card-${product.id}`}
    >
      <div className="img-zoom aspect-[3/4] mb-4 bg-[#0a0a0a] border border-[#262626]">
        <img 
          src={product.images[0] || "https://images.unsplash.com/photo-1647540977003-9a9e6f3b5fb9?w=400"}
          alt={product.name}
          className="w-full h-full object-cover"
        />
      </div>
      <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-1">
        {product.category}
      </p>
      <h3 className="text-sm sm:text-base font-bold uppercase tracking-tight mb-2">
        {product.name}
      </h3>
      <p className="font-mono text-sm">
        ${product.price.toFixed(2)}
      </p>
    </div>
  );
};

// Shop Page
const Shop = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchData = async () => {
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/products`),
        axios.get(`${API}/categories`)
      ]);
      setProducts(productsRes.data);
      setCategories(categoriesRes.data);
    } catch {
      console.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const params = selectedCategory ? `?category=${selectedCategory}` : "";
      const res = await axios.get(`${API}/products${params}`);
      setProducts(res.data);
    } catch {
      console.error("Failed to fetch products");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-8">
          Shop
        </h1>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCategory("")}
            className={`text-xs font-mono uppercase tracking-widest px-4 py-2 border transition-colors ${
              selectedCategory === "" 
                ? "border-white bg-white text-black" 
                : "border-[#262626] text-gray-400 hover:border-white"
            }`}
            data-testid="filter-all"
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs font-mono uppercase tracking-widest px-4 py-2 border transition-colors ${
                selectedCategory === cat 
                  ? "border-white bg-white text-black" 
                  : "border-[#262626] text-gray-400 hover:border-white"
              }`}
              data-testid={`filter-${cat}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 font-mono uppercase tracking-widest">
              No products found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-[#262626]">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Product Detail Page
const ProductDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToCart, cartLoading } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`${API}/products/${id}`);
      setProduct(res.data);
      if (res.data.sizes.length > 0) {
        setSelectedSize(res.data.sizes[0]);
      }
    } catch {
      toast.error("Product not found");
      navigate("/shop");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!user) {
      toast.error("Please login to add items to cart");
      navigate("/login");
      return;
    }
    if (product.sizes.length > 0 && !selectedSize) {
      toast.error("Please select a size");
      return;
    }
    addToCart(product.id, quantity, selectedSize);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Image */}
          <div className="aspect-[3/4] bg-[#0a0a0a] border border-[#262626]">
            <img 
              src={product.images[0] || "https://images.unsplash.com/photo-1647540977003-9a9e6f3b5fb9?w=800"}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="flex flex-col">
            <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              {product.category}
            </p>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-4">
              {product.name}
            </h1>
            <p className="text-2xl font-mono mb-6">
              ${product.price.toFixed(2)}
            </p>
            <p className="text-gray-400 mb-8 leading-relaxed">
              {product.description}
            </p>

            {/* Size Selector */}
            {product.sizes.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">
                  Size
                </p>
                <div className="flex gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`size-btn ${selectedSize === size ? "active" : ""}`}
                      data-testid={`size-${size}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="mb-8">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-3">
                Quantity
              </p>
              <div className="flex items-center gap-4">
                <button 
                  className="qty-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  data-testid="qty-decrease"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono text-lg w-8 text-center" data-testid="qty-value">
                  {quantity}
                </span>
                <button 
                  className="qty-btn"
                  onClick={() => setQuantity(quantity + 1)}
                  data-testid="qty-increase"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={cartLoading || !product.in_stock}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="add-to-cart-btn"
            >
              {cartLoading ? "Adding..." : !product.in_stock ? "Out of Stock" : "Add to Cart"}
            </button>

            {/* TikTok Link */}
            {product.tiktok_link && (
              <a 
                href={product.tiktok_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 text-xs font-mono uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-2 justify-center"
                data-testid="tiktok-link"
              >
                View on TikTok <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Cart Page
const Cart = () => {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-4">Please Login</h1>
          <p className="text-gray-400 mb-6">Login to view your cart</p>
          <button onClick={() => navigate("/login")} className="btn-primary" data-testid="login-from-cart">
            Login
          </button>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-600" strokeWidth={1} />
          <h1 className="text-2xl font-black mb-4">Your Cart is Empty</h1>
          <p className="text-gray-400 mb-6">Add some items to get started</p>
          <button onClick={() => navigate("/shop")} className="btn-primary" data-testid="continue-shopping">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-8">
          Cart
        </h1>

        <div className="border border-[#262626] divide-y divide-[#262626]">
          {cart.items.map((item) => (
            <div key={`${item.product_id}-${item.size}`} className="p-4 sm:p-6 flex gap-4" data-testid={`cart-item-${item.product_id}`}>
              <div className="w-20 h-24 bg-[#0a0a0a] border border-[#262626] flex-shrink-0">
                <img 
                  src={item.product?.images?.[0] || "https://images.unsplash.com/photo-1647540977003-9a9e6f3b5fb9?w=200"}
                  alt={item.product?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-bold uppercase tracking-tight">{item.product?.name}</h3>
                <p className="text-xs font-mono text-gray-500 mt-1">
                  {item.size && `Size: ${item.size}`}
                </p>
                <p className="font-mono mt-2">${item.product?.price?.toFixed(2)}</p>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button 
                  onClick={() => removeFromCart(item.product_id)}
                  className="text-gray-500 hover:text-white"
                  data-testid={`remove-${item.product_id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button 
                    className="qty-btn w-8 h-8"
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    data-testid={`cart-qty-decrease-${item.product_id}`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono w-6 text-center">{item.quantity}</span>
                  <button 
                    className="qty-btn w-8 h-8"
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    data-testid={`cart-qty-increase-${item.product_id}`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-6 border border-[#262626] p-4 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-gray-400">Subtotal</span>
            <span className="font-mono text-xl">${cart.total.toFixed(2)}</span>
          </div>
          <button 
            onClick={() => navigate("/checkout")}
            className="btn-primary w-full"
            data-testid="proceed-to-checkout"
          >
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
};

// Checkout Page
const Checkout = () => {
  const { cart, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [step, setStep] = useState(1);
  const [shipping, setShipping] = useState({
    address: "",
    city: "",
    zip: "",
    country: ""
  });

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleCreateOrder = async () => {
    if (!shipping.address || !shipping.city || !shipping.zip || !shipping.country) {
      toast.error("Please fill all shipping details");
      return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post(`${API}/orders`, {
        shipping_address: shipping.address,
        shipping_city: shipping.city,
        shipping_zip: shipping.zip,
        shipping_country: shipping.country
      });
      setOrderId(res.data.id);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paypalOrderId) => {
    try {
      await axios.post(`${API}/paypal/capture-order`, {
        order_id: orderId,
        paypal_order_id: paypalOrderId
      });
      toast.success("Payment successful!");
      navigate(`/order-success/${orderId}`);
    } catch (err) {
      toast.error("Failed to process payment");
    }
  };

  if (!user || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-black mb-4">Cart is Empty</h1>
          <button onClick={() => navigate("/shop")} className="btn-primary">
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-8">
          Checkout
        </h1>

        {/* Step Indicator */}
        <div className="flex items-center gap-4 mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-white" : "text-gray-500"}`}>
            <span className="w-8 h-8 border flex items-center justify-center font-mono text-sm">1</span>
            <span className="text-xs font-mono uppercase tracking-widest">Shipping</span>
          </div>
          <div className="flex-1 h-px bg-[#262626]" />
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-white" : "text-gray-500"}`}>
            <span className="w-8 h-8 border flex items-center justify-center font-mono text-sm">2</span>
            <span className="text-xs font-mono uppercase tracking-widest">Payment</span>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
                Address
              </label>
              <input
                type="text"
                value={shipping.address}
                onChange={(e) => setShipping({ ...shipping, address: e.target.value })}
                className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
                placeholder="123 Main Street"
                data-testid="shipping-address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={shipping.city}
                  onChange={(e) => setShipping({ ...shipping, city: e.target.value })}
                  className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
                  placeholder="New York"
                  data-testid="shipping-city"
                />
              </div>
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={shipping.zip}
                  onChange={(e) => setShipping({ ...shipping, zip: e.target.value })}
                  className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
                  placeholder="10001"
                  data-testid="shipping-zip"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
                Country
              </label>
              <input
                type="text"
                value={shipping.country}
                onChange={(e) => setShipping({ ...shipping, country: e.target.value })}
                className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
                placeholder="United States"
                data-testid="shipping-country"
              />
            </div>

            {/* Order Summary */}
            <div className="border border-[#262626] p-4 mt-8">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">
                Order Summary
              </h3>
              {cart.items.map((item) => (
                <div key={`${item.product_id}-${item.size}`} className="flex justify-between text-sm mb-2">
                  <span>{item.product?.name} x{item.quantity}</span>
                  <span className="font-mono">${(item.product?.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-[#262626] mt-4 pt-4 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-mono text-lg">${cart.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleCreateOrder}
              disabled={loading}
              className="btn-primary w-full"
              data-testid="continue-to-payment"
            >
              {loading ? "Processing..." : "Continue to Payment"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="border border-[#262626] p-6 mb-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4">
                Total Amount
              </h3>
              <p className="text-3xl font-mono">${cart.total.toFixed(2)}</p>
            </div>
            
            <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "USD" }}>
              <PayPalButtons
                style={{ 
                  layout: "vertical",
                  color: "white",
                  shape: "rect",
                  label: "pay"
                }}
                createOrder={(data, actions) => {
                  return actions.order.create({
                    purchase_units: [{
                      amount: {
                        value: cart.total.toFixed(2)
                      }
                    }]
                  });
                }}
                onApprove={async (data, actions) => {
                  const details = await actions.order.capture();
                  handlePaymentSuccess(details.id);
                }}
                onError={(err) => {
                  console.error("PayPal Error:", err);
                  toast.error("Payment failed. Please try again.");
                }}
              />
            </PayPalScriptProvider>

            <button
              onClick={() => setStep(1)}
              className="btn-secondary w-full mt-4"
              data-testid="back-to-shipping"
            >
              Back to Shipping
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Order Success Page
const OrderSuccess = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 border border-white mx-auto mb-6 flex items-center justify-center">
          <Package className="w-10 h-10" strokeWidth={1} />
        </div>
        <h1 className="text-3xl font-black mb-4">Order Confirmed</h1>
        <p className="text-gray-400 mb-2">Thank you for your purchase!</p>
        <p className="text-xs font-mono text-gray-500 mb-8">Order ID: {id}</p>
        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate("/account")} className="btn-secondary" data-testid="view-orders">
            View Orders
          </button>
          <button onClick={() => navigate("/shop")} className="btn-primary" data-testid="continue-shopping-success">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
};

// Login Page
const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(email, password);
      toast.success("Welcome back!");
      if (user.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black tracking-tighter text-center mb-8">
          Login
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 border border-red-500/20">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
              placeholder="your@email.com"
              required
              data-testid="login-email"
            />
          </div>
          
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
              placeholder="••••••••"
              required
              data-testid="login-password"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            data-testid="login-submit"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        
        <p className="text-center mt-6 text-gray-400 text-sm">
          Don't have an account?{" "}
          <Link to="/register" className="text-white hover:underline" data-testid="register-link">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

// Register Page
const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(email, password, name);
      toast.success("Account created!");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-black tracking-tighter text-center mb-8">
          Create Account
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 border border-red-500/20">
              {error}
            </div>
          )}
          
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
              placeholder="Your Name"
              required
              data-testid="register-name"
            />
          </div>
          
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
              placeholder="your@email.com"
              required
              data-testid="register-email"
            />
          </div>
          
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-black border border-[#262626] focus:border-white"
              placeholder="••••••••"
              required
              minLength={6}
              data-testid="register-password"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
            data-testid="register-submit"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        
        <p className="text-center mt-6 text-gray-400 text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-white hover:underline" data-testid="login-from-register">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

// Account Page
const Account = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/orders`);
      setOrders(res.data);
    } catch {
      console.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const getStatusClass = (status) => {
    const classes = {
      pending: "status-pending",
      paid: "status-paid",
      processing: "status-processing",
      shipped: "status-shipped",
      delivered: "status-delivered",
      cancelled: "status-cancelled"
    };
    return classes[status] || "status-pending";
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">
            Account
          </h1>
          <button onClick={handleLogout} className="btn-secondary flex items-center gap-2" data-testid="logout-btn">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* User Info */}
        <div className="border border-[#262626] p-6 mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">
            Account Details
          </p>
          <p className="text-lg font-bold">{user?.name}</p>
          <p className="text-gray-400">{user?.email}</p>
        </div>

        {/* Orders */}
        <h2 className="text-xl font-black mb-4">Order History</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="loader" />
          </div>
        ) : orders.length === 0 ? (
          <div className="border border-[#262626] p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-gray-600" strokeWidth={1} />
            <p className="text-gray-400">No orders yet</p>
            <button onClick={() => navigate("/shop")} className="btn-primary mt-4" data-testid="start-shopping">
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="border border-[#262626] p-4 sm:p-6" data-testid={`order-${order.id}`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-mono text-gray-500 mb-1">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                    <p className="font-mono text-sm">Order #{order.id.slice(-8)}</p>
                  </div>
                  <span className={`status-badge ${getStatusClass(order.status)}`}>
                    {order.status}
                  </span>
                </div>
                <div className="border-t border-[#262626] pt-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm mb-1">
                      <span>{item.name} x{item.quantity}</span>
                      <span className="font-mono">${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between mt-2 pt-2 border-t border-[#262626]">
                    <span className="font-bold">Total</span>
                    <span className="font-mono">${order.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Admin Dashboard
const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, ordersRes, productsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/orders`),
        axios.get(`${API}/products`)
      ]);
      setStats(statsRes.data);
      setOrders(ordersRes.data);
      setProducts(productsRes.data);
    } catch (err) {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loader" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tighter mb-8">
          Admin Dashboard
        </h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-[#262626] pb-4">
          {["overview", "orders", "products"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-mono uppercase tracking-widest px-4 py-2 transition-colors ${
                activeTab === tab ? "text-white bg-white/10" : "text-gray-500 hover:text-white"
              }`}
              data-testid={`tab-${tab}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Orders" value={stats.total_orders} />
            <StatCard label="Paid Orders" value={stats.paid_orders} />
            <StatCard label="Revenue" value={`$${stats.total_revenue.toFixed(2)}`} />
            <StatCard label="Profit" value={`$${stats.total_profit.toFixed(2)}`} />
          </div>
        )}

        {activeTab === "orders" && <AdminOrders orders={orders} onUpdate={fetchData} />}
        {activeTab === "products" && <AdminProducts products={products} onUpdate={fetchData} />}
      </div>
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div className="border border-[#262626] p-6">
    <p className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">{label}</p>
    <p className="text-2xl font-mono">{value}</p>
  </div>
);

// Admin Orders Component
const AdminOrders = ({ orders, onUpdate }) => {
  const updateStatus = async (orderId, status) => {
    try {
      await axios.put(`${API}/admin/orders/${orderId}/status`, { status });
      toast.success("Order status updated");
      onUpdate();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const getStatusClass = (status) => {
    const classes = {
      pending: "status-pending",
      paid: "status-paid",
      processing: "status-processing",
      shipped: "status-shipped",
      delivered: "status-delivered",
      cancelled: "status-cancelled"
    };
    return classes[status] || "status-pending";
  };

  return (
    <div className="overflow-x-auto">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Profit</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} data-testid={`admin-order-${order.id}`}>
              <td className="font-mono text-sm">{order.id.slice(-8)}</td>
              <td>{order.user_email}</td>
              <td className="font-mono">${order.total.toFixed(2)}</td>
              <td className="font-mono text-green-400">${order.profit.toFixed(2)}</td>
              <td>
                <span className={`status-badge ${getStatusClass(order.status)}`}>
                  {order.status}
                </span>
              </td>
              <td>
                <select
                  value={order.status}
                  onChange={(e) => updateStatus(order.id, e.target.value)}
                  className="bg-black border border-[#262626] px-2 py-1 text-sm"
                  data-testid={`status-select-${order.id}`}
                >
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Admin Products Component
const AdminProducts = ({ products, onUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    tiktok_cost: "",
    tiktok_link: "",
    images: "",
    category: "",
    sizes: "",
    in_stock: true
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      tiktok_cost: "",
      tiktok_link: "",
      images: "",
      category: "",
      sizes: "",
      in_stock: true
    });
    setEditProduct(null);
  };

  const handleEdit = (product) => {
    setEditProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      tiktok_cost: product.tiktok_cost.toString(),
      tiktok_link: product.tiktok_link,
      images: product.images.join(", "),
      category: product.category,
      sizes: product.sizes.join(", "),
      in_stock: product.in_stock
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      tiktok_cost: parseFloat(formData.tiktok_cost),
      tiktok_link: formData.tiktok_link,
      images: formData.images.split(",").map(s => s.trim()).filter(Boolean),
      category: formData.category,
      sizes: formData.sizes.split(",").map(s => s.trim()).filter(Boolean),
      in_stock: formData.in_stock
    };

    try {
      if (editProduct) {
        await axios.put(`${API}/admin/products/${editProduct.id}`, data);
        toast.success("Product updated");
      } else {
        await axios.post(`${API}/admin/products`, data);
        toast.success("Product created");
      }
      resetForm();
      setShowForm(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save product");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await axios.delete(`${API}/admin/products/${id}`);
      toast.success("Product deleted");
      onUpdate();
    } catch {
      toast.error("Failed to delete product");
    }
  };

  return (
    <div>
      <button
        onClick={() => { resetForm(); setShowForm(!showForm); }}
        className="btn-primary mb-6"
        data-testid="add-product-btn"
      >
        {showForm ? "Cancel" : "Add Product"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-[#262626] p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              required
              data-testid="product-name-input"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Category</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              required
              data-testid="product-category-input"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Selling Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              required
              data-testid="product-price-input"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">TikTok Cost ($)</label>
            <input
              type="number"
              step="0.01"
              value={formData.tiktok_cost}
              onChange={(e) => setFormData({ ...formData, tiktok_cost: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              required
              data-testid="product-tiktok-cost-input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">TikTok Link</label>
            <input
              type="url"
              value={formData.tiktok_link}
              onChange={(e) => setFormData({ ...formData, tiktok_link: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              required
              data-testid="product-tiktok-link-input"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626] h-24"
              required
              data-testid="product-description-input"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Image URLs (comma-separated)</label>
            <input
              type="text"
              value={formData.images}
              onChange={(e) => setFormData({ ...formData, images: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              data-testid="product-images-input"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest text-gray-500 mb-2">Sizes (comma-separated)</label>
            <input
              type="text"
              value={formData.sizes}
              onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
              className="w-full px-4 py-2 bg-black border border-[#262626]"
              placeholder="S, M, L, XL"
              data-testid="product-sizes-input"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.in_stock}
              onChange={(e) => setFormData({ ...formData, in_stock: e.target.checked })}
              className="w-4 h-4"
              id="in_stock"
              data-testid="product-in-stock-input"
            />
            <label htmlFor="in_stock" className="text-sm">In Stock</label>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" data-testid="save-product-btn">
              {editProduct ? "Update Product" : "Create Product"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>TikTok Cost</th>
              <th>Profit</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} data-testid={`admin-product-${product.id}`}>
                <td>
                  <div className="w-12 h-12 bg-[#0a0a0a] border border-[#262626]">
                    <img 
                      src={product.images[0] || "https://images.unsplash.com/photo-1647540977003-9a9e6f3b5fb9?w=100"}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </td>
                <td className="font-bold">{product.name}</td>
                <td className="text-gray-400">{product.category}</td>
                <td className="font-mono">${product.price.toFixed(2)}</td>
                <td className="font-mono text-gray-400">${product.tiktok_cost.toFixed(2)}</td>
                <td className="font-mono text-green-400">${(product.price - product.tiktok_cost).toFixed(2)}</td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-xs font-mono uppercase tracking-widest text-gray-400 hover:text-white"
                      data-testid={`edit-product-${product.id}`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="text-xs font-mono uppercase tracking-widest text-red-400 hover:text-red-300"
                      data-testid={`delete-product-${product.id}`}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="min-h-screen bg-black text-white">
            <Toaster 
              position="top-center" 
              toastOptions={{
                style: {
                  background: '#0a0a0a',
                  border: '1px solid #262626',
                  color: '#fff',
                  fontFamily: 'Satoshi, sans-serif'
                }
              }}
            />
            <Routes>
              <Route path="/" element={<><Header /><Home /><Footer /></>} />
              <Route path="/shop" element={<><Header /><Shop /><Footer /></>} />
              <Route path="/product/:id" element={<><Header /><ProductDetail /><Footer /></>} />
              <Route path="/cart" element={<><Header /><Cart /><Footer /></>} />
              <Route path="/checkout" element={<><Header /><Checkout /></>} />
              <Route path="/order-success/:id" element={<><Header /><OrderSuccess /></>} />
              <Route path="/login" element={<><Header /><Login /></>} />
              <Route path="/register" element={<><Header /><Register /></>} />
              <Route path="/account" element={
                <ProtectedRoute>
                  <Header /><Account /><Footer />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute adminOnly>
                  <Header /><AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
