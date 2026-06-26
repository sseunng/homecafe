# Implementation Plan - Home Cafe Kiosk

This implementation plan outlines the steps to build a real-time Home Cafe Kiosk application. It will run a unified Node.js server that hosts both the Express API/WebSockets and serves the built React (Vite) frontend.

---

## User Review Required

> [!IMPORTANT]
> - **Port Configuration**: The Express server will run on port `3000` by default. In Proxmox, you can reverse-proxy port `80`/`443` to port `3000` on the VM/LXC.
> - **Security PIN**: The admin panel will be accessible via a hidden gesture (long press on the guest main screen title) followed by entering a 4-digit PIN (default: `2026`).

---

## Open Questions

> [!NOTE]
> None at the moment. If you have any modifications or preferences (e.g., changing the default PIN or default port), please let us know.

---

## Proposed Architecture

```mermaid
graph TD
    subgraph Frontend (React + Vite)
        GuestPage[Guest Mode - Menu & Cart]
        AdminPage[Admin Mode - Order Mgmt & Menu Mgmt]
        SocketClient[Socket.io-client]
    end
    
    subgraph Backend (Node.js + Express)
        ExpressServer[Express Server]
        SocketServer[Socket.io Server]
        JSONDB[(JSON DB - Menu/Orders)]
        Uploads[(Uploads Directory)]
    end

    GuestPage -->|HTTP GET/POST| ExpressServer
    AdminPage -->|HTTP POST/DELETE| ExpressServer
    SocketClient <-->|WebSockets (Real-time Status/Alerts)| SocketServer
    ExpressServer -->|Read/Write| JSONDB
    ExpressServer -->|Save Images| Uploads
```

---

## Proposed Changes

### 1. Project Setup
We will initialize a monorepo-style structure:
- `/client`: React (Vite) Frontend.
- `/server`: Node.js + Express + Socket.io Backend.
- Root `package.json`: Contains scripts to run both client and server in development using `concurrently`, and to build/serve in production.

#### [NEW] [package.json](file:///Users/choeseunghyeong/Desktop/kiosk/package.json) (Root configuration)
Manages root-level npm scripts:
- `npm run dev`: Runs both backend and frontend concurrently in development mode.
- `npm run build`: Builds the React frontend and copies it into server static directory.
- `npm run start`: Runs the Node.js production server.

---

### 2. Backend Component (Express + Socket.io)

#### [NEW] [package.json](file:///Users/choeseunghyeong/Desktop/kiosk/server/package.json)
Server dependencies: `express`, `cors`, `socket.io`, `multer`, `uuid`.

#### [NEW] [server.js](file:///Users/choeseunghyeong/Desktop/kiosk/server/server.js)
The main Express app:
- Initializes HTTP server and Socket.io.
- Implements WebSockets logic:
  - Connection registration (tracks socket mapping to `guestId`).
  - Broadcasts `new_order` to connected admins.
  - Emits `order_status_update` and `order_completed` to specific guest sockets.
- REST API routes:
  - `GET /api/menu`: Fetch all menu items.
  - `POST /api/menu`: Create a menu item (supports image upload via `multer`).
  - `DELETE /api/menu/:id`: Delete a menu item.
  - `GET /api/orders`: Fetch active/past orders (Admin).
  - `POST /api/orders`: Create a new order (Guest). Automatically increments order numbers (resets daily or keeps sequential).
  - `PATCH /api/orders/:id/status`: Update order status (Admin: pending -> preparing -> completed).
- Static file serving: Serves built frontend from `../client/dist` and uploaded images from `./uploads`.

#### [NEW] [data_store.js](file:///Users/choeseunghyeong/Desktop/kiosk/server/data_store.js)
A lightweight JSON-based file database to persist menu items and order history. Keeps data safe across server restarts.

---

### 3. Frontend Component (React + Vite + Toss Style CSS)

#### [NEW] [Vite App Initialization](file:///Users/choeseunghyeong/Desktop/kiosk/client)
Initialize Vite project with React.

#### [MODIFY] [client/src/App.css](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/App.css)
The global style definition implementing the Toss Order theme:
- Custom properties for HSL colors (Toss Blue, Soft Gray, Deep Charcoal, White).
- Border-radius values (`16px`/`24px`).
- Animations for bottom sheets, fade-ins, and active click scaling.

#### [NEW] [client/src/context/SocketContext.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/context/SocketContext.jsx)
React context to share the Socket.io client instance across components, managing real-time notifications and status updates.

#### [NEW] [client/src/components/GuestView.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/components/GuestView.jsx)
Guest interface:
- Menu browsing by category.
- Cart state management (items, quantities).
- Bottom sheet for item selection with "Add to Cart" and "Order Now" choices.
- Toast alerts ("Added to Cart") with quick navigation.
- Sequential checkout review page.
- Current active orders tracking screen (real-time updates via Socket.io).

#### [NEW] [client/src/components/AdminView.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/components/AdminView.jsx)
Admin interface:
- Protected by PIN entry.
- Real-time orders dashboard grouped by status:
  - **주문 대기 (Pending)**: [수락] button.
  - **맛있게 만드는 중 ☕ (Preparing)**: [제조 완료] button.
  - **제조 완료 (Completed)**: Log history.
- Menu management page: form to add new items (name, description, image file upload) and delete existing items.

---

## Verification Plan

### Automated Verification
- Run backend lint and basic script startup checks.
- Test endpoint calls using curl/fetch commands.

### Manual Verification
1. Open the kiosk guest web app on multiple browser tabs (simulating multiple users).
2. Add items to the cart and place orders. Observe order numbers increment sequentially (e.g. #1, #2).
3. Access the Admin view (by clicking/holding the hidden trigger and entering PIN `2026`).
4. Accept a pending order $\rightarrow$ check if guest view updates to "맛있게 만드는 중 ☕".
5. Complete the order $\rightarrow$ verify that the specific guest browser receives the "제조 완료" notification overlay and sound.
6. Upload new menu items with images in the Admin view, and verify they appear instantly in the Guest menu view.
