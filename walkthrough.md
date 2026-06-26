# Development Walkthrough - Home Cafe Kiosk

We have successfully built and verified the **Home Cafe Kiosk** web application. It features a modern, clean, Toss-inspired frontend and a real-time Node.js backend.

---

## What Was Completed

### 1. Root & Script Orchestration
- Root [package.json](file:///Users/choeseunghyeong/Desktop/kiosk/package.json) created to run the entire stack concurrently in development mode (`npm run dev`) and handle combined dependencies.
- Added building scripts (`npm run build`) to generate the React production build that the backend serves.

### 2. Backend (Express & WebSockets)
- [server.js](file:///Users/choeseunghyeong/Desktop/kiosk/server/server.js): Built a consolidated Express server running on port `3000`. Configured Socket.io to manage role-based rooms (`admin` and `guest_guestId`). Added image upload endpoints using `multer`.
- [data_store.js](file:///Users/choeseunghyeong/Desktop/kiosk/server/data_store.js): Implemented daily resetting sequential order numbers (e.g. starting at `#1` each morning) and seeded a default, high-quality initial menu.

### 3. Frontend (React + Vite + Toss CSS)
- [index.css](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/index.css) & [App.css](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/App.css): Defined a curated HSL color palette (Toss Blue, Deep Charcoal, Soft Gray) with automatic **dark mode compatibility**, modular border radiuses, and smooth transitions/micro-animations (`active: scale(0.96)` scale downs on clicks).
- [SocketContext.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/context/SocketContext.jsx): Orchestrates real-time events. Implemented **Web Audio API synthesis** to chime sweet notes when drinks are ready or new orders arrive.
- [GuestView.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/components/GuestView.jsx): Category filter tabs, option customization sheets, Cart Toast alerts, and active order tracking views.
- [AdminView.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/components/AdminView.jsx): PIN entry screen (using standard `2026`), 3-column real-time order board (주문 대기 $\rightarrow$ 맛있게 만드는 중 ☕ $\rightarrow$ 제조 완료), and menu manager to add, delete, or toggle out-of-stock items.

---

## Local Verification & Testing

1. Verified compile pipeline: Built successfully in Vite.
2. Started dev stack: Both frontend and backend launch concurrently.
3. Verified API endpoints: Tested order placement and menu queries successfully via cURL.

---

## Proxmox Deployment Instructions

To run the Kiosk permanently on your Proxmox server (`192.168.1.38`), you can use **Docker Compose** inside an LXC Container or VM.

### Step 1: Transfer Project Files
Compress the project files on your Mac and transfer them to your Proxmox host or container via `scp`:
```bash
# From your Mac terminal
cd /Users/choeseunghyeong/Desktop
tar -czf kiosk.tar.gz kiosk
scp kiosk.tar.gz root@192.168.1.38:/root/
```

### Step 2: Extract on Proxmox VM/LXC
Log in to your server and extract the archive:
```bash
# In your Proxmox VM/LXC terminal
cd /root
tar -xzf kiosk.tar.gz
cd kiosk
```

### Step 3: Run with Docker Compose
Ensure `docker` and `docker-compose` are installed, then spin up the container:
```bash
docker compose up -d --build
```
> [!NOTE]
> The container will automatically build the React assets, mount persistent volumes for your database (`server/data`) and uploads (`server/public/uploads`), and listen on port `3000`.

### Step 4: Map Port and Generate QR Code
1. access the kiosk in your network at: `http://192.168.1.38:3000`
2. Enter the host view by clicking/holding the **"☕ Home Cafe"** title logo in the top-left 5 times, then entering the PIN **`2026`**.
3. Generate a QR code pointing to `http://192.168.1.38:3000` and print it for your guest tables!
