# Xeno Katherine Analytics Platform 2025
## (Katherine Parshad) - Shopify Analytics & Real-time Dashboard

![Xeno Katherine Analytics Platform](./images/project-banner.png)

*Xeno Katherine is a comprehensive Shopify analytics and real-time dashboard platform that enables store owners to monitor their business metrics, track customer behavior, and gain actionable insights. Built with modern technologies including React, Node.js, Express, PostgreSQL, and Socket.io for real-time updates.*

## Full App Flow Overview
When an order is placed on the connected Shopify store, webhooks instantly notify our backend server. The system processes the order data, stores it in PostgreSQL via Prisma ORM, updates Redis cache for optimal performance, and broadcasts real-time updates to the dashboard via Socket.io. Users can view comprehensive analytics including revenue trends, customer insights, product performance, and business health metrics.

## Demo & Live URLs

- **Frontend Dashboard:** <a href="https://xeno-project-kathy.vercel.app/" target="_blank">Dashboard Link</a>
- **Backend API Base:** <a href="https://xeno-project-kathy-production.up.railway.app/" target="_blank">Base API URL</a> *(API only - no web interface)*
- **Health Check:** <a href="https://xeno-project-kathy-production.up.railway.app/api/health" target="_blank">API Health Check</a>
- **Connected Shopify Store:** <a href="https://xeno-project-kathy.myshopify.com/" target="_blank">Live Shopify Store</a> *(Live store integration)*

## Dashboard Login Credentials

Use the demo account below to access the dashboard:

- **Email:** `admin@xeno.com`
- **Password:** `admin123`



## Features Implemented
- 🔐 **Secure JWT-based authentication** with protected routes and session management
- 📊 **Real-time analytics dashboard** with comprehensive business metrics and KPIs
- 🛍️ **Shopify integration** for seamless data synchronization and webhook processing
- ⚡ **Live updates** via Socket.io for instant order notifications and data refresh
- 📈 **Advanced analytics** including revenue trends, customer insights, and product performance
- 🎯 **Business health scoring** with intelligent recommendations and alerts
- 📱 **Responsive design** optimized for desktop and mobile viewing
- 🌐 **Multi-currency support** with Indian Rupee (₹) formatting
- 🔄 **Background job processing** with Redis for scalable data operations
- 📋 **Order management** with detailed customer information and purchase history
- 🚀 **Production-ready deployment** on Railway (backend) and Vercel (frontend)

## How I Approached the Problem
I designed a robust full-stack architecture separating frontend and backend concerns for scalability and maintainability. The backend uses Express.js with a modular structure - middleware for authentication and validation, services for business logic, and Prisma for type-safe database operations.

The frontend leverages React with custom hooks for state management, reusable components for UI consistency, and Socket.io integration for real-time updates. I implemented comprehensive error handling, loading states, and user feedback mechanisms.

For real-time functionality, I integrated Socket.io for bidirectional communication between the server and dashboard, ensuring users receive instant notifications for new orders, payments, and sync status updates.

## Trade-offs I Made
- **Prisma ORM**: Chose for rapid development and type safety, though it adds some overhead compared to raw SQL queries
- **Socket.io**: Implemented for real-time features but adds complexity for simple applications
- **Redis integration**: Added for caching and session management, though it requires additional infrastructure
- **Comprehensive analytics**: Built extensive dashboard features focusing on user experience over performance optimization for large datasets
- **JWT authentication**: Implemented custom auth system rather than third-party solutions for better control and learning

# App Architecture

```mermaid
flowchart TB
    F["Frontend (React + Vite)<br>Dashboard | Authentication | Real-time Updates | Analytics"]
    API["Backend API (Express.js)<br>Auth APIs | Analytics APIs | Webhook Handlers | Socket.io"]
    DB["Database (PostgreSQL)<br>Users | Orders | Customers | Products | Events"]
    SHOP["Shopify Store<br>Orders | Products | Customers | Webhooks"]
    REDIS["Redis Cache<br>Session Data | Real-time Events | Job Queue"]
    SOCKET["Socket.io<br>Real-time Updates | Notifications | Sync Status"]

    F <--> API
    API <--> DB
    API <--> SHOP
    API <--> REDIS
    API <--> SOCKET
    F <--> SOCKET
    SHOP --> API
```

## Flow Summary
*Step-by-step application flow breakdown*

### `01` Application Entry Point
**`server.js`** initializes Express app with CORS, middleware, Socket.io integration, and comprehensive route handling

### `02` Authentication System

- **Routes:** `auth.js` handles login/logout endpoints with JWT token management
- **Middleware:** `auth.js` provides JWT verification and request authentication
- **Utilities:** `password.js` handles secure password operations with bcrypt
- **Database:** Prisma models for user management and session handling

### `03` Protected Dashboard Routes
All analytics and dashboard endpoints use JWT middleware for secure access control

### `04` Real-time Analytics Dashboard

- **Frontend:** React components with real-time Socket.io integration
- **Backend:** Express routes serving comprehensive analytics data
- **Database Queries:** Optimized Prisma queries for order, customer, and product analytics
- **Caching:** Redis integration for improved performance

### `05` Shopify Integration & Webhooks

- **Webhook Handlers:** Process real-time Shopify events (orders, payments, customers)
- **Data Synchronization:** Background processing for store data updates
- **Security:** HMAC verification for webhook authenticity
- **Real-time Updates:** Socket.io broadcasts for instant dashboard updates

#### **Implemented Webhook Events:**
- **📦 Orders**: `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`
- **👥 Customers**: `customers/create`, `customers/update`, `customers/delete`  
- **🛍️ Products**: `products/create`, `products/update`
- **🔌 App Management**: `app/uninstalled`

All webhook endpoints are secured with HMAC SHA-256 verification and include comprehensive error handling and logging.

### `06` Background Processing
**Redis-based job system** handles asynchronous operations like data sync, notifications, and cleanup tasks

### `07` Data Persistence
**Prisma ORM** with PostgreSQL provides type-safe, scalable database operations with comprehensive relationship management

## Tech Stack
*Modern, production-ready technologies*

### Frontend
<table>
<tr>
<td>
<strong>React</strong><br>
<sub>18.3.1</sub>
</td>
<td>
<strong>Vite</strong><br>
<sub>5.4.1</sub>
</td>
<td>
<strong>Socket.io Client</strong><br>
<sub>4.8.1</sub>
</td>
<td>
<strong>Axios</strong><br>
<sub>HTTP Client</sub>
</td>
</tr>
</table>

### Backend
<table>
<tr>
<td>
<strong>Node.js</strong><br>
<sub>Express.js</sub>
</td>
<td>
<strong>Prisma</strong><br>
<sub>6.16.1</sub>
</td>
<td>
<strong>PostgreSQL</strong><br>
<sub>Database</sub>
</td>
<td>
<strong>Socket.io</strong><br>
<sub>4.8.1</sub>
</td>
</tr>
</table>

### Infrastructure & DevOps
<table>
<tr>
<td>
<strong>Railway</strong><br>
<sub>Backend Hosting</sub>
</td>
<td>
<strong>Vercel</strong><br>
<sub>Frontend Hosting</sub>
</td>
<td>
<strong>Redis</strong><br>
<sub>Caching & Sessions</sub>
</td>
<td>
<strong>JWT</strong><br>
<sub>Authentication</sub>
</td>
</tr>
</table>

## Component Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant A as Auth Hook
    participant S as Socket.io
    participant API as Backend API
    participant DB as Database
    
    U->>D: Access Dashboard
    D->>A: Check Authentication
    A->>API: Validate JWT Token
    API-->>A: Auth Status
    A-->>D: User Authenticated
    
    D->>S: Connect Socket
    S->>API: Establish WebSocket
    API-->>S: Connection Confirmed
    
    D->>API: Fetch Analytics Data
    API->>DB: Query Business Metrics
    DB-->>API: Analytics Results
    API-->>D: Dashboard Data
    
    Note over D: Real-time Dashboard Active
    
    API->>S: Broadcast Updates
    S-->>D: Live Data Updates
    D->>D: Update UI Components
```

## Frontend Architecture Flow

```mermaid
graph TD
    subgraph "React Application"
        APP[App.jsx - Main Router]
        LOGIN[LoginPage Component]
        DASH[Dashboard Component]
        PROTECTED[ProtectedRoute HOC]
    end
    
    subgraph "State Management"
        AUTH_CONTEXT[AuthContext]
        AUTH_HOOK[useAuth Hook]
        SOCKET_SERVICE[Socket Service]
    end
    
    subgraph "API Layer"
        API_UTILS[API Utilities]
        SOCKET_CLIENT[Socket.io Client]
        HTTP_CLIENT[Axios Instance]
    end
    
    APP --> LOGIN
    APP --> PROTECTED
    PROTECTED --> DASH
    DASH --> AUTH_HOOK
    AUTH_HOOK --> AUTH_CONTEXT
    DASH --> SOCKET_SERVICE
    SOCKET_SERVICE --> SOCKET_CLIENT
    API_UTILS --> HTTP_CLIENT
    
    class APP,LOGIN,DASH,PROTECTED component
    class AUTH_CONTEXT,AUTH_HOOK,SOCKET_SERVICE state
    class API_UTILS,SOCKET_CLIENT,HTTP_CLIENT api
```

## Backend Architecture Flow

```mermaid
graph TD
    subgraph "Express Application"
        SERVER[server.js - Main Entry]
        ROUTES[Route Handlers]
        MIDDLEWARE[Auth & Validation]
        SOCKET[Socket.io Server]
    end
    
    subgraph "Business Logic"
        WEBHOOK[Webhook Service]
        REDIS[Redis Service]
        SCHEDULER[Background Jobs]
    end
    
    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        POSTGRES[PostgreSQL DB]
        MIGRATIONS[Database Migrations]
    end
    
    SERVER --> ROUTES
    SERVER --> MIDDLEWARE
    SERVER --> SOCKET
    ROUTES --> WEBHOOK
    ROUTES --> REDIS
    WEBHOOK --> SCHEDULER
    ROUTES --> PRISMA
    PRISMA --> POSTGRES
    PRISMA --> MIGRATIONS
    
    class SERVER,ROUTES,MIDDLEWARE,SOCKET server
    class WEBHOOK,REDIS,SCHEDULER service
    class PRISMA,POSTGRES,MIGRATIONS data
```

## Backend Components (Detailed)
Comprehensive breakdown of backend architecture and responsibilities.

- **Core Application** (`/`)
    - `server.js` — Express application setup, middleware configuration, Socket.io integration, and graceful shutdown handling
    - `package.json` — Dependencies, scripts, and project metadata with production optimizations

- **Authentication & Security** (`/middleware`, `/routes`)
    - `middleware/auth.js` — JWT token verification, user authentication, and request protection
    - `routes/auth.js` — Login/logout endpoints with comprehensive error handling
    - `utils/password.js` — Secure password hashing and verification with bcrypt

- **Analytics & Dashboard** (`/routes`)
    - Dashboard routes providing real-time business metrics, revenue analytics, and customer insights
    - Comprehensive data aggregation with optimized database queries
    - Real-time WebSocket integration for live updates

- **Shopify Integration**
    - **Unified webhook endpoint** (`/api/webhooks/shopify`) for processing all Shopify events
    - **Comprehensive event handling** for orders, customers, products, and app lifecycle
    - **HMAC verification** for webhook security and authenticity
    - **Real-time data synchronization** with automatic database updates
    - **Socket.io integration** for instant dashboard notifications

- **Real-time Communication**
    - Socket.io server for bidirectional communication with dashboard
    - Real-time notifications for orders, payments, and system events
    - Background job status updates and sync progress tracking

- **Database Layer** (Prisma ORM)
    - `prisma/schema.prisma` — Database schema with User, Order, Customer, and Product models
    - Type-safe database operations with comprehensive relationship handling
    - Database migrations for schema evolution and data integrity

- **Infrastructure Services**
    - `services/redisService.js` — Caching, session management, and real-time event handling
    - Background job processing with queue management
    - Logging and monitoring for production debugging

## Project Structure
*Organized folder structure for scalability and maintainability*

### Backend Structure
```
backend/
├── package.json
├── server.js
├── create-admin.js
├── ingest.js
├── scheduler.js
├── middleware/
│   ├── auth.js
│   ├── logging.js
│   └── validation.js
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20250914173018_init/
│       └── 20250914192305_add_user_authentication/
├── routes/
│   └── auth.js
├── services/
│   └── webhookService.js
└── utils/
    └── password.js
```

### Frontend Structure
```
frontend/
├── package.json
├── vite.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   ├── assets/
│   │   └── react.svg
│   ├── components/
│   │   ├── Dashboard.jsx
│   │   ├── LoginPage.jsx
│   │   └── ProtectedRoute.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useAuth.js
│   └── utils/
│       └── api.js
└── public/
    └── vite.svg
```

## Quick Start
*Get up and running in minutes*

### Prerequisites

<table>
<tr>
<td>
<strong>Node.js</strong><br>
<sub>v18 or higher</sub>
</td>
<td>
<strong>PostgreSQL</strong><br>
<sub>Database server</sub>
</td>
<td>
<strong>Redis</strong><br>
<sub>Optional - for caching</sub>
</td>
</tr>
</table>

### `01` Shopify Configuration (Optional)

1. **Create development store** or use existing Shopify store
2. **Generate private app** with read permissions for orders, customers, products
3. **Configure webhooks** pointing to your backend URL
4. **Copy API credentials** for integration

### `02` Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Generate Prisma client and setup database
npx prisma generate
npx prisma db push

# Start development server
npm start
```

#### Backend Environment Variables (.env)
```bash
# Database Connection
DATABASE_URL="postgresql://username:password@localhost:5432/xeno_katherine"

# JWT Authentication
JWT_SECRET="your-super-secure-jwt-secret-key-here"
ADMIN_JWT_TOKEN="admin-jwt-token-for-authentication"

# Shopify Configuration (Optional)
SHOPIFY_STORE_URL="your-store.myshopify.com"
SHOPIFY_ACCESS_TOKEN="your-shopify-access-token"
SHOPIFY_WEBHOOK_SECRET="your-webhook-secret"

# Server Configuration
NODE_ENV="development"
PORT="3001"

# Frontend CORS Configuration
FRONTEND_URL="https://xeno-project-kathy.vercel.app"
```

### `03` Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Application URLs

**Backend API Base:** `https://xeno-project-kathy-production.up.railway.app` *(API endpoints only)*  
**Frontend Dashboard:** `https://xeno-project-kathy.vercel.app`  
**Health Check:** `https://xeno-project-kathy-production.up.railway.app/api/health`

> **Note:** The backend is an API-only server. Visit the health check endpoint to verify it's running, or use the frontend dashboard to interact with the application.

## API Reference
*Comprehensive RESTful API for dashboard and analytics*

### Authentication Endpoints

<table>
<tr>
<th>Method</th>
<th>Endpoint</th>
<th>Description</th>
</tr>
<tr>
<td>POST</td>
<td><code>/api/auth/login</code></td>
<td>Authenticate user and return JWT token</td>
</tr>
<tr>
<td>POST</td>
<td><code>/api/auth/logout</code></td>
<td>Logout user and invalidate token</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/auth/me</code></td>
<td>Get current user information</td>
</tr>
</table>

### Analytics & Dashboard Endpoints

<table>
<tr>
<th>Method</th>
<th>Endpoint</th>
<th>Description</th>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/overview</code></td>
<td>General business overview and KPIs</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/daily-stats</code></td>
<td>Daily revenue and order statistics</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/monthly-trends</code></td>
<td>Monthly business trends and growth</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/customer-growth</code></td>
<td>Customer acquisition and growth metrics</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/top-customers</code></td>
<td>Highest spending customers</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/recent-orders</code></td>
<td>Latest orders with customer details</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/product-performance</code></td>
<td>Top performing products by revenue</td>
</tr>
<tr>
<td>GET</td>
<td><code>/api/analytics/business-health</code></td>
<td>Business health score and recommendations</td>
</tr>
</table>

### System & Utility Endpoints

<table>
<tr>
<th>Method</th>
<th>Endpoint</th>
<th>Description</th>
</tr>
<tr>
<td>GET</td>
<td><code>/api/health</code></td>
<td>System health check with database status</td>
</tr>
<tr>
<td>POST</td>
<td><code>/api/sync</code></td>
<td>Trigger manual data synchronization</td>
</tr>
<tr>
<td>POST</td>
<td><code>/api/setup/admin</code></td>
<td>One-time admin user setup</td>
</tr>
</table>

### Webhook Endpoints

<table>
<tr>
<th>Method</th>
<th>Endpoint</th>
<th>Description</th>
</tr>
<tr>
<td>POST</td>
<td><code>/api/webhooks/shopify</code></td>
<td>Unified Shopify webhook handler with HMAC verification</td>
</tr>
</table>

#### **Supported Webhook Topics:**
- **Orders**: `orders/create`, `orders/updated`, `orders/paid`, `orders/cancelled`, `orders/fulfilled`
- **Customers**: `customers/create`, `customers/update`, `customers/delete`
- **Products**: `products/create`, `products/update`
- **App**: `app/uninstalled`

> **Note:** Protected endpoints require JWT token in `Authorization: Bearer <token>` header. Webhook endpoints use HMAC verification for security.

## Database Schema
*Comprehensive data model for analytics and user management*

<table>
<tr>
<td>
<strong>User</strong><br>
<sub>Authentication & profiles</sub>
</td>
<td>
<strong>Order</strong><br>
<sub>Transaction records</sub>
</td>
<td>
<strong>Customer</strong><br>
<sub>Customer information</sub>
</td>
<td>
<strong>Product</strong><br>
<sub>Product catalog</sub>
</td>
</tr>
</table>

### Key Relationships
- Users can have multiple orders
- Orders belong to customers
- Orders contain multiple products
- Comprehensive foreign key relationships for data integrity

## Real-time Features
*Live dashboard updates and notifications*

### Socket.io Integration
- **Real-time order notifications** - Instant alerts for new orders and payments
- **Live analytics updates** - Dashboard data refreshes without page reload
- **Sync status tracking** - Real-time progress of data synchronization
- **Connection management** - Automatic reconnection and error handling

### Notification System
- **Browser notifications** for new orders when dashboard is active
- **Visual indicators** for new data availability
- **Sound alerts** for important events (configurable)

## Deployment
*Production-ready cloud deployment*

<table>
<tr>
<th>Component</th>
<th>Platform</th>
<th>URL</th>
</tr>
<tr>
<td><strong>Frontend</strong></td>
<td>Vercel</td>
<td><a href="https://xeno-project-kathy.vercel.app" target="_blank">xeno-project-kathy.vercel.app</a></td>
</tr>
<tr>
<td><strong>Backend API</strong></td>
<td>Railway</td>
<td><a href="https://xeno-project-kathy-production.up.railway.app/api/health" target="_blank">API Health Check</a></td>
</tr>
<tr>
<td><strong>Database</strong></td>
<td>Railway PostgreSQL</td>
<td>Managed database service</td>
</tr>
<tr>
<td><strong>Connected Store</strong></td>
<td>Shopify</td>
<td><a href="https://xeno-project-kathy.myshopify.com" target="_blank">Live Shopify Store</a></td>
</tr>
<tr>
<td><strong>Redis Cache</strong></td>
<td>Railway Redis</td>
<td>Session and caching layer</td>
</tr>
</table>

### Environment Configuration
- **Production environment variables** configured in Railway dashboard
- **CORS configuration** for cross-origin requests between frontend and backend
- **SSL/TLS encryption** for secure data transmission
- **Database connection pooling** for optimal performance

## Project Features & Capabilities

### 📊 **Advanced Analytics Dashboard**
- Comprehensive business metrics with real-time updates
- Revenue trends, customer growth, and product performance analytics
- Interactive charts and visualizations for data insights
- Business health scoring with intelligent recommendations

### 🔐 **Robust Authentication System**
- JWT-based authentication with secure token management
- Protected routes with automatic redirection
- Session management with Redis for scalability
- Admin user setup and management

### ⚡ **Real-time Communication**
- Socket.io integration for live dashboard updates
- Instant notifications for new orders and payments
- Real-time sync status and progress tracking
- Automatic reconnection and error handling

### 🛍️ **Shopify Integration**
- Webhook processing for real-time store events
- Secure HMAC verification for webhook authenticity
- Comprehensive data synchronization for orders, customers, and products
- Background job processing for scalable operations

### 🎨 **Modern User Interface**
- Responsive design optimized for all device sizes
- Clean, intuitive interface with smooth animations
- Dark/light theme support with system preference detection
- Loading states and error handling for better user experience

## Project Limitations & Considerations

- **Database scaling**: Current setup optimized for medium-scale operations; may require optimization for very large datasets
- **Real-time connections**: Socket.io connections are maintained per user; consider connection pooling for large-scale deployments
- **Currency support**: Currently optimized for Indian Rupee (₹) formatting; can be extended for multi-currency support
- **Authentication**: Uses custom JWT implementation; can be extended with OAuth providers for enterprise use
- **Caching strategy**: Redis implementation is basic; can be enhanced with more sophisticated caching patterns
- **Error monitoring**: Basic error handling implemented; production deployment would benefit from comprehensive monitoring tools
- **API rate limiting**: Basic rate limiting in place; may need enhancement for high-traffic scenarios

## Future Enhancements

- **Multi-store support**: Extend platform to handle multiple Shopify stores per user
- **Advanced analytics**: Implement predictive analytics and machine learning insights
- **Export functionality**: Add data export capabilities (PDF, CSV, Excel)
- **Mobile applications**: Develop native mobile apps for iOS and Android
- **Integration ecosystem**: Add support for other e-commerce platforms (WooCommerce, Magento)
- **Advanced notifications**: Email and SMS notifications for critical events
- **Team collaboration**: Multi-user access with role-based permissions

---

**Xeno Katherine Analytics Platform 2025**  
*Empowering businesses with real-time insights and comprehensive analytics*

*Created by Katherine Parshad*  
*Full-stack Developer & Analytics Enthusiast*

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

For support, email parshad.katherine@gmail.com or create an issue in this repository.
