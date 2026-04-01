# SEVYN E-commerce PRD

## Original Problem Statement
Build a website to sell clothing products with a modern, minimalistic design featuring gothic tribal chrome attributes in black, white, and grey colors. Products are sourced from TikTok - when customers pay on the website, it pays for the TikTok product and the rest of the money goes as profit to the seller via PayPal.

## Brand Identity
- **Brand Name**: SEVYN
- **Theme**: Gothic tribal chrome aesthetic
- **Color Palette**: Pure black (#000000), white (#FFFFFF), grey shades
- **Typography**: Cabinet Grotesk (headings), Satoshi (body), JetBrains Mono (labels)

## User Personas
1. **Customer**: Browse products, create account, add to cart, checkout with PayPal
2. **Admin**: Manage products (add TikTok products with cost/profit), track orders, view stats

## Core Requirements (Static)
- E-commerce website with PayPal payments
- TikTok product sourcing (manual link entry)
- Admin panel for product management
- User accounts with order tracking
- Price split: TikTok cost + seller profit

## What's Been Implemented
- **2024-04-01**: MVP Complete
  - Full e-commerce frontend with gothic theme
  - SEVYN branding with chrome logo
  - Product CRUD (admin)
  - Shopping cart functionality
  - PayPal checkout integration (sandbox)
  - User registration/login with JWT auth
  - Order management system
  - Admin dashboard with stats (revenue, profit, orders)
  - Mobile-responsive design

## Technical Stack
- **Backend**: FastAPI, MongoDB, JWT auth
- **Frontend**: React, Tailwind CSS, PayPal SDK
- **Database**: MongoDB (sevyn_db)

## API Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`
- Products: `/api/products`, `/api/products/:id`, `/api/categories`
- Cart: `/api/cart`, `/api/cart/add`, `/api/cart/:id`
- Orders: `/api/orders`, `/api/orders/:id`
- Admin: `/api/admin/products`, `/api/admin/orders`, `/api/admin/stats`
- PayPal: `/api/paypal/create-order`, `/api/paypal/capture-order`

## Prioritized Backlog

### P0 (Critical - Done)
- [x] User authentication
- [x] Product management
- [x] Shopping cart
- [x] PayPal checkout
- [x] Order tracking

### P1 (High Priority)
- [ ] Production PayPal credentials setup
- [ ] Email notifications for orders
- [ ] Product image upload (currently URL-based)
- [ ] Inventory tracking

### P2 (Medium Priority)
- [ ] Wishlist feature
- [ ] Product reviews
- [ ] Discount codes
- [ ] Analytics dashboard

### P3 (Nice to Have)
- [ ] Social login (Google)
- [ ] Product variants (colors)
- [ ] TikTok API auto-import

## Next Tasks
1. Get PayPal production credentials from user
2. Set up email notifications for order confirmations
3. Add image upload functionality via object storage
