const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { MenuStore, OrdersStore, CategoriesStore, ConfigStore } = require('./data_store');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Set up image upload storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'menu-' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

// Serve static uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Serve React production build if it exists
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// -------------------------------------------------------------
// REST API API Routes
// -------------------------------------------------------------

// 1. Menu API
app.get('/api/menu', (req, res) => {
  try {
    const list = MenuStore.getAll();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu list' });
  }
});

app.post('/api/menu', upload.single('image'), (req, res) => {
  try {
    const { name, description, category, options } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

    const newItem = {
      id: `menu_${Date.now()}`,
      name,
      description: description || '',
      category,
      image: imagePath,
      options: options ? JSON.parse(options) : [],
      available: true
    };

    MenuStore.add(newItem);
    
    // Broadcast updated menu to all clients
    io.emit('menu_updated', MenuStore.getAll());
    
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Add menu error:', error);
    res.status(500).json({ error: 'Failed to add menu item' });
  }
});

app.patch('/api/menu/:id/availability', (req, res) => {
  try {
    const { available } = req.body;
    const updated = MenuStore.updateAvailability(req.params.id, available);
    if (!updated) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    
    // Broadcast updated menu to all clients
    io.emit('menu_updated', MenuStore.getAll());
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update menu item' });
  }
});

app.delete('/api/menu/:id', (req, res) => {
  try {
    MenuStore.delete(req.params.id);
    
    // Broadcast updated menu to all clients
    io.emit('menu_updated', MenuStore.getAll());
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

// 1.5. Categories API
app.get('/api/categories', (req, res) => {
  try {
    const list = CategoriesStore.getAll();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.post('/api/categories', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    const updated = CategoriesStore.add(name);
    io.emit('categories_updated', updated);
    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add category' });
  }
});

app.delete('/api/categories/:name', (req, res) => {
  try {
    const name = req.params.name;
    const updated = CategoriesStore.delete(name);
    io.emit('categories_updated', updated);
    res.json({ success: true, categories: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// 1.7. Config & Admin Security API
app.get('/api/config', (req, res) => {
  try {
    const config = ConfigStore.get();
    res.json({ kioskTitle: config.kioskTitle });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const { kioskTitle, adminPin } = req.body;
    const updateData = {};
    if (kioskTitle !== undefined) updateData.kioskTitle = kioskTitle;
    if (adminPin && adminPin.trim().length === 4) updateData.adminPin = adminPin.trim();

    const updated = ConfigStore.save(updateData);
    
    // Broadcast config update (without PIN) to all clients
    io.emit('config_updated', { kioskTitle: updated.kioskTitle });
    
    res.json({ kioskTitle: updated.kioskTitle });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update config' });
  }
});

app.post('/api/admin/verify-pin', (req, res) => {
  try {
    const { pin } = req.body;
    const config = ConfigStore.get();
    if (pin === config.adminPin) {
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// 2. Orders API
app.get('/api/orders', (req, res) => {
  try {
    const list = OrdersStore.getAll();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/orders/:id', (req, res) => {
  try {
    const list = OrdersStore.getAll();
    const order = list.find(o => o.id === req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

app.post('/api/orders', (req, res) => {
  try {
    const { guestId, items } = req.body;
    if (!guestId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'guestId and items (array) are required' });
    }

    const newOrder = OrdersStore.create({ guestId, items });

    // Notify admins of new order
    io.to('admin').emit('new_order', newOrder);
    
    // Notify this specific guest in their guest room
    io.to(`guest_${guestId}`).emit('order_created', newOrder);

    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.patch('/api/orders/:id/status', (req, res) => {
  try {
    const { status } = req.body; // pending, preparing, completed, cancelled
    const validStatuses = ['pending', 'preparing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updatedOrder = OrdersStore.updateStatus(req.params.id, status);
    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Broadcast status change to admins
    io.to('admin').emit('order_status_changed', updatedOrder);

    // Notify the target guest room
    io.to(`guest_${updatedOrder.guestId}`).emit('order_status_updated', updatedOrder);

    // If completed, trigger special alert to the guest
    if (status === 'completed') {
      io.to(`guest_${updatedOrder.guestId}`).emit('order_completed_alert', {
        orderNumber: updatedOrder.orderNumber,
        items: updatedOrder.items
      });
    }

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// React Router Fallback - Route all other requests to React app index.html
if (fs.existsSync(clientDistPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// -------------------------------------------------------------
// Socket.io Connection & Room Join Logic
// -------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Registration handler for separating roles
  socket.on('register', (data) => {
    const { guestId, role } = data;
    
    if (role === 'admin') {
      socket.join('admin');
      console.log(`Socket ${socket.id} joined 'admin' room`);
    } else if (guestId) {
      const roomName = `guest_${guestId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined '${roomName}' room`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`-----------------------------------------------------`);
  console.log(`🚀 Home Cafe Kiosk backend running at http://localhost:${PORT}`);
  console.log(`📱 Available on local network at http://192.168.1.38:${PORT} (if host IP is correct)`);
  console.log(`-----------------------------------------------------`);
});
