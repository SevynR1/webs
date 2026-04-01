from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import bcrypt
import jwt
import secrets

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="SEVYN E-commerce API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ MODELS ============

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: datetime

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float  # Selling price
    amazon_cost: float  # Amazon product cost
    amazon_link: str
    images: List[str]
    category: str
    sizes: List[str] = []
    in_stock: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    amazon_cost: Optional[float] = None
    amazon_link: Optional[str] = None
    images: Optional[List[str]] = None
    category: Optional[str] = None
    sizes: Optional[List[str]] = None
    in_stock: Optional[bool] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    description: str
    price: float
    amazon_cost: float
    amazon_link: str
    images: List[str]
    category: str
    sizes: List[str]
    in_stock: bool
    created_at: datetime

class CartItem(BaseModel):
    product_id: str
    quantity: int
    size: str

class CartItemUpdate(BaseModel):
    quantity: int

class OrderCreate(BaseModel):
    shipping_address: str
    shipping_city: str
    shipping_zip: str
    shipping_country: str

class OrderResponse(BaseModel):
    id: str
    user_id: str
    items: List[dict]
    total: float
    profit: float
    status: str
    shipping_address: str
    shipping_city: str
    shipping_zip: str
    shipping_country: str
    paypal_order_id: Optional[str] = None
    created_at: datetime

# ============ PASSWORD HELPERS ============

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# ============ JWT HELPERS ============

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "customer"),
            "created_at": user["created_at"]
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============ AUTH ROUTES ============

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": "customer",
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": data.name, "role": "customer"}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": user["name"], "role": user.get("role", "customer")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

# ============ PRODUCT ROUTES ============

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    products = await db.products.find(query, {"_id": 1, "name": 1, "description": 1, "price": 1, "tiktok_cost": 1, "tiktok_link": 1, "images": 1, "category": 1, "sizes": 1, "in_stock": 1, "created_at": 1}).to_list(100)
    
    return [
        ProductResponse(
            id=str(p["_id"]),
            name=p["name"],
            description=p["description"],
            price=p["price"],
            amazon_cost=p.get("amazon_cost", p.get("tiktok_cost", 0)),
            amazon_link=p.get("amazon_link", p.get("tiktok_link", "")),
            images=p.get("images", []),
            category=p.get("category", ""),
            sizes=p.get("sizes", []),
            in_stock=p.get("in_stock", True),
            created_at=p.get("created_at", datetime.now(timezone.utc))
        )
        for p in products
    ]

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str):
    try:
        product = await db.products.find_one({"_id": ObjectId(product_id)})
    except:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return ProductResponse(
        id=str(product["_id"]),
        name=product["name"],
        description=product["description"],
        price=product["price"],
        amazon_cost=product.get("amazon_cost", product.get("tiktok_cost", 0)),
        amazon_link=product.get("amazon_link", product.get("tiktok_link", "")),
        images=product.get("images", []),
        category=product.get("category", ""),
        sizes=product.get("sizes", []),
        in_stock=product.get("in_stock", True),
        created_at=product.get("created_at", datetime.now(timezone.utc))
    )

@api_router.get("/categories")
async def get_categories():
    categories = await db.products.distinct("category")
    return categories

# ============ ADMIN PRODUCT ROUTES ============

@api_router.post("/admin/products", response_model=ProductResponse)
async def create_product(data: ProductCreate, request: Request):
    await get_admin_user(request)
    
    product_doc = {
        "name": data.name,
        "description": data.description,
        "price": data.price,
        "amazon_cost": data.amazon_cost,
        "amazon_link": data.amazon_link,
        "images": data.images,
        "category": data.category,
        "sizes": data.sizes,
        "in_stock": data.in_stock,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.products.insert_one(product_doc)
    
    return ProductResponse(
        id=str(result.inserted_id),
        name=data.name,
        description=data.description,
        price=data.price,
        amazon_cost=data.amazon_cost,
        amazon_link=data.amazon_link,
        images=data.images,
        category=data.category,
        sizes=data.sizes,
        in_stock=data.in_stock,
        created_at=product_doc["created_at"]
    )

@api_router.put("/admin/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, data: ProductUpdate, request: Request):
    await get_admin_user(request)
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    try:
        result = await db.products.find_one_and_update(
            {"_id": ObjectId(product_id)},
            {"$set": update_data},
            return_document=True
        )
    except:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not result:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return ProductResponse(
        id=str(result["_id"]),
        name=result["name"],
        description=result["description"],
        price=result["price"],
        amazon_cost=result.get("amazon_cost", result.get("tiktok_cost", 0)),
        amazon_link=result.get("amazon_link", result.get("tiktok_link", "")),
        images=result.get("images", []),
        category=result.get("category", ""),
        sizes=result.get("sizes", []),
        in_stock=result.get("in_stock", True),
        created_at=result.get("created_at", datetime.now(timezone.utc))
    )

@api_router.delete("/admin/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    await get_admin_user(request)
    
    try:
        result = await db.products.delete_one({"_id": ObjectId(product_id)})
    except:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"message": "Product deleted"}

# ============ CART ROUTES ============

@api_router.get("/cart")
async def get_cart(request: Request):
    user = await get_current_user(request)
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    
    if not cart:
        return {"items": [], "total": 0}
    
    # Populate product details
    items_with_details = []
    total = 0
    for item in cart.get("items", []):
        try:
            product = await db.products.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item_total = product["price"] * item["quantity"]
                total += item_total
                items_with_details.append({
                    "product_id": item["product_id"],
                    "quantity": item["quantity"],
                    "size": item.get("size", ""),
                    "product": {
                        "id": str(product["_id"]),
                        "name": product["name"],
                        "price": product["price"],
                        "images": product.get("images", [])
                    }
                })
        except:
            continue
    
    return {"items": items_with_details, "total": total}

@api_router.post("/cart/add")
async def add_to_cart(data: CartItem, request: Request):
    user = await get_current_user(request)
    
    # Verify product exists
    try:
        product = await db.products.find_one({"_id": ObjectId(data.product_id)})
    except:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    
    if not cart:
        await db.carts.insert_one({
            "user_id": user["id"],
            "items": [{"product_id": data.product_id, "quantity": data.quantity, "size": data.size}]
        })
    else:
        # Check if item already exists
        item_exists = False
        for item in cart["items"]:
            if item["product_id"] == data.product_id and item.get("size") == data.size:
                item["quantity"] += data.quantity
                item_exists = True
                break
        
        if not item_exists:
            cart["items"].append({"product_id": data.product_id, "quantity": data.quantity, "size": data.size})
        
        await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": cart["items"]}})
    
    return {"message": "Item added to cart"}

@api_router.put("/cart/{product_id}")
async def update_cart_item(product_id: str, data: CartItemUpdate, request: Request):
    user = await get_current_user(request)
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    for item in cart["items"]:
        if item["product_id"] == product_id:
            if data.quantity <= 0:
                cart["items"].remove(item)
            else:
                item["quantity"] = data.quantity
            break
    
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": cart["items"]}})
    return {"message": "Cart updated"}

@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, request: Request):
    user = await get_current_user(request)
    
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$pull": {"items": {"product_id": product_id}}}
    )
    return {"message": "Item removed from cart"}

@api_router.delete("/cart")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    await db.carts.delete_one({"user_id": user["id"]})
    return {"message": "Cart cleared"}

# ============ ORDER ROUTES ============

@api_router.post("/orders")
async def create_order(data: OrderCreate, request: Request):
    user = await get_current_user(request)
    
    cart = await db.carts.find_one({"user_id": user["id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")
    
    # Calculate totals
    items_with_details = []
    total = 0
    total_tiktok_cost = 0
    
    for item in cart["items"]:
        try:
            product = await db.products.find_one({"_id": ObjectId(item["product_id"])})
            if product:
                item_total = product["price"] * item["quantity"]
                item_tiktok = product.get("tiktok_cost", 0) * item["quantity"]
                total += item_total
                total_tiktok_cost += item_tiktok
                items_with_details.append({
                    "product_id": item["product_id"],
                    "name": product["name"],
                    "price": product["price"],
                    "tiktok_cost": product.get("tiktok_cost", 0),
                    "quantity": item["quantity"],
                    "size": item.get("size", "")
                })
        except:
            continue
    
    profit = total - total_tiktok_cost
    
    order_doc = {
        "user_id": user["id"],
        "items": items_with_details,
        "total": total,
        "tiktok_cost": total_tiktok_cost,
        "profit": profit,
        "status": "pending",
        "shipping_address": data.shipping_address,
        "shipping_city": data.shipping_city,
        "shipping_zip": data.shipping_zip,
        "shipping_country": data.shipping_country,
        "paypal_order_id": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    result = await db.orders.insert_one(order_doc)
    order_id = str(result.inserted_id)
    
    return {
        "id": order_id,
        "total": total,
        "profit": profit,
        "items": items_with_details
    }

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(request: Request):
    user = await get_current_user(request)
    
    orders = await db.orders.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    
    return [
        OrderResponse(
            id=str(o["_id"]),
            user_id=o["user_id"],
            items=o["items"],
            total=o["total"],
            profit=o.get("profit", 0),
            status=o["status"],
            shipping_address=o["shipping_address"],
            shipping_city=o["shipping_city"],
            shipping_zip=o["shipping_zip"],
            shipping_country=o["shipping_country"],
            paypal_order_id=o.get("paypal_order_id"),
            created_at=o["created_at"]
        )
        for o in orders
    ]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, request: Request):
    user = await get_current_user(request)
    
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": user["id"]})
    except:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return OrderResponse(
        id=str(order["_id"]),
        user_id=order["user_id"],
        items=order["items"],
        total=order["total"],
        profit=order.get("profit", 0),
        status=order["status"],
        shipping_address=order["shipping_address"],
        shipping_city=order["shipping_city"],
        shipping_zip=order["shipping_zip"],
        shipping_country=order["shipping_country"],
        paypal_order_id=order.get("paypal_order_id"),
        created_at=order["created_at"]
    )

# ============ PAYPAL ROUTES ============

@api_router.post("/paypal/create-order")
async def create_paypal_order(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    order_id = body.get("order_id")
    
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": user["id"]})
    except:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Return order details for PayPal JS SDK to create order
    return {
        "id": str(order["_id"]),
        "total": order["total"],
        "currency": "USD"
    }

@api_router.post("/paypal/capture-order")
async def capture_paypal_order(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    order_id = body.get("order_id")
    paypal_order_id = body.get("paypal_order_id")
    
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id), "user_id": user["id"]})
    except:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order with PayPal order ID and mark as paid
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {
            "paypal_order_id": paypal_order_id,
            "status": "paid",
            "paid_at": datetime.now(timezone.utc)
        }}
    )
    
    # Clear the cart
    await db.carts.delete_one({"user_id": user["id"]})
    
    return {"success": True, "message": "Payment captured successfully"}

# ============ ADMIN ROUTES ============

@api_router.get("/admin/orders")
async def get_all_orders(request: Request):
    await get_admin_user(request)
    
    orders = await db.orders.find().sort("created_at", -1).to_list(100)
    
    result = []
    for o in orders:
        # Get user info
        try:
            user = await db.users.find_one({"_id": ObjectId(o["user_id"])})
            user_email = user["email"] if user else "Unknown"
        except:
            user_email = "Unknown"
        
        result.append({
            "id": str(o["_id"]),
            "user_id": o["user_id"],
            "user_email": user_email,
            "items": o["items"],
            "total": o["total"],
            "amazon_cost": o.get("amazon_cost", o.get("tiktok_cost", 0)),
            "profit": o.get("profit", 0),
            "status": o["status"],
            "shipping_address": o["shipping_address"],
            "shipping_city": o["shipping_city"],
            "shipping_zip": o["shipping_zip"],
            "shipping_country": o["shipping_country"],
            "paypal_order_id": o.get("paypal_order_id"),
            "created_at": o["created_at"].isoformat() if isinstance(o["created_at"], datetime) else o["created_at"]
        })
    
    return result

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, request: Request):
    await get_admin_user(request)
    body = await request.json()
    new_status = body.get("status")
    
    valid_statuses = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    try:
        result = await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"status": new_status}}
        )
    except:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order status updated"}

@api_router.get("/admin/stats")
async def get_admin_stats(request: Request):
    await get_admin_user(request)
    
    total_orders = await db.orders.count_documents({})
    paid_orders = await db.orders.count_documents({"status": {"$in": ["paid", "processing", "shipped", "delivered"]}})
    
    # Calculate total revenue and profit
    pipeline = [
        {"$match": {"status": {"$in": ["paid", "processing", "shipped", "delivered"]}}},
        {"$group": {
            "_id": None,
            "total_revenue": {"$sum": "$total"},
            "total_profit": {"$sum": "$profit"}
        }}
    ]
    
    result = await db.orders.aggregate(pipeline).to_list(1)
    
    if result:
        total_revenue = result[0]["total_revenue"]
        total_profit = result[0]["total_profit"]
    else:
        total_revenue = 0
        total_profit = 0
    
    total_products = await db.products.count_documents({})
    total_users = await db.users.count_documents({"role": "customer"})
    
    return {
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "total_revenue": total_revenue,
        "total_profit": total_profit,
        "total_products": total_products,
        "total_users": total_users
    }

# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "SEVYN API Running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("category")
    await db.orders.create_index("user_id")
    await db.carts.create_index("user_id", unique=True)
    
    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@sevyn.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    
    # Write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n")
        f.write(f"## Admin\n")
        f.write(f"- Email: {admin_email}\n")
        f.write(f"- Password: {admin_password}\n")
        f.write(f"- Role: admin\n\n")
        f.write(f"## Auth Endpoints\n")
        f.write(f"- POST /api/auth/register\n")
        f.write(f"- POST /api/auth/login\n")
        f.write(f"- POST /api/auth/logout\n")
        f.write(f"- GET /api/auth/me\n")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
