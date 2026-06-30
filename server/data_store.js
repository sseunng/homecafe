const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const MENU_FILE = path.join(DATA_DIR, 'menu.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

// Ensure directories exist
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initial default menu if empty
const DEFAULT_MENU = [
  {
    id: "menu_1",
    name: "아메리카노",
    description: "깊고 진한 에스프레소에 시원한 물을 더한 깔끔하고 고소한 커피",
    image: "/uploads/default_americano.png",
    category: "커피",
    available: true
  },
  {
    id: "menu_2",
    name: "카페라떼",
    description: "에스프레소의 고소함과 부드러운 우유가 조화롭게 어우러진 라떼",
    image: "/uploads/default_latte.png",
    category: "커피",
    available: true
  },
  {
    id: "menu_3",
    name: "바닐라라떼",
    description: "천연 바닐라 빈 시럽을 넣어 더욱 달콤하고 향긋한 라떼",
    image: "/uploads/default_vanilla_latte.png",
    category: "커피",
    available: true
  },
  {
    id: "menu_4",
    name: "자몽에이드",
    description: "톡 쏘는 탄산수에 수제 자몽 청을 듬뿍 넣어 상큼하고 달콤한 에이드",
    image: "/uploads/default_grapefruit_ade.png",
    category: "논커피",
    available: true
  },
  {
    id: "menu_5",
    name: "캐모마일 블렌드",
    description: "마음을 차분하게 해주는 은은한 사과 향의 허브 티",
    image: "/uploads/default_chamomile.png",
    category: "티",
    available: true
  }
];

// Helper functions to load/save JSON
function readJSON(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJSON(filePath, defaultValue);
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return defaultValue;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
  }
}

// Menu Store Methods
const MenuStore = {
  getAll: () => {
    return readJSON(MENU_FILE, DEFAULT_MENU);
  },
  
  add: (item) => {
    const list = readJSON(MENU_FILE, DEFAULT_MENU);
    list.push(item);
    writeJSON(MENU_FILE, list);
    return item;
  },
  
  delete: (id) => {
    const list = readJSON(MENU_FILE, DEFAULT_MENU);
    const updated = list.filter(item => item.id !== id);
    writeJSON(MENU_FILE, updated);
    return updated;
  },

  updateAvailability: (id, available) => {
    const list = readJSON(MENU_FILE, DEFAULT_MENU);
    const item = list.find(item => item.id === id);
    if (item) {
      item.available = available;
      writeJSON(MENU_FILE, list);
    }
    return item;
  },

  reorder: (orderedIds) => {
    const list = readJSON(MENU_FILE, DEFAULT_MENU);
    const sorted = [...list].sort((a, b) => {
      const idxA = orderedIds.indexOf(a.id);
      const idxB = orderedIds.indexOf(b.id);
      const valA = idxA === -1 ? 9999 : idxA;
      const valB = idxB === -1 ? 9999 : idxB;
      return valA - valB;
    });
    writeJSON(MENU_FILE, sorted);
    return sorted;
  }
};

// Orders Store Methods
const OrdersStore = {
  getAll: () => {
    return readJSON(ORDERS_FILE, []);
  },
  
  create: (orderData) => {
    const list = readJSON(ORDERS_FILE, []);
    
    // Calculate sequential order number reset daily
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD (UTC base)
    
    // Simple local date calculation
    const localTodayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];

    const todayOrders = list.filter(o => {
      const orderDate = new Date(o.createdAt);
      const orderDateStr = new Date(orderDate.getTime() - (orderDate.getTimezoneOffset() * 60000))
        .toISOString()
        .split('T')[0];
      return orderDateStr === localTodayStr;
    });

    let nextNumber = 1;
    if (todayOrders.length > 0) {
      const maxNum = Math.max(...todayOrders.map(o => o.orderNumber || 0));
      nextNumber = maxNum + 1;
    }

    const newOrder = {
      id: orderData.id || `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderNumber: nextNumber,
      guestId: orderData.guestId,
      nickname: orderData.nickname || '',
      items: orderData.items, // Array of { menuId, name, quantity, options }
      status: 'pending', // pending, preparing, completed, cancelled
      createdAt: now.toISOString()
    };

    list.push(newOrder);
    writeJSON(ORDERS_FILE, list);
    return newOrder;
  },
  
  updateStatus: (id, status) => {
    const list = readJSON(ORDERS_FILE, []);
    const order = list.find(o => o.id === id);
    if (order) {
      order.status = status;
      writeJSON(ORDERS_FILE, list);
    }
    return order;
  }
};

const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const DEFAULT_CATEGORIES = ['커피', '논커피', '티', '디저트'];

// Categories Store Methods
const CategoriesStore = {
  getAll: () => {
    const list = readJSON(CATEGORIES_FILE, DEFAULT_CATEGORIES);
    const cleaned = list.map(name => name.replace(/[^\w\sㄱ-힣]/g, '').trim());
    if (JSON.stringify(list) !== JSON.stringify(cleaned)) {
      writeJSON(CATEGORIES_FILE, cleaned);
    }
    return cleaned;
  },
  
  add: (name) => {
    const cleanedName = name.replace(/[^\w\sㄱ-힣]/g, '').trim();
    const list = CategoriesStore.getAll();
    if (!list.includes(cleanedName)) {
      list.push(cleanedName);
      writeJSON(CATEGORIES_FILE, list);
    }
    return list;
  },
  
  delete: (name) => {
    const cleanedName = name.replace(/[^\w\sㄱ-힣]/g, '').trim();
    const list = CategoriesStore.getAll();
    const updated = list.filter(item => item !== cleanedName);
    writeJSON(CATEGORIES_FILE, updated);
    return updated;
  },

  reorder: (orderedList) => {
    const cleaned = orderedList.map(name => name.replace(/[^\w\sㄱ-힣]/g, '').trim());
    writeJSON(CATEGORIES_FILE, cleaned);
    return cleaned;
  }
};

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG = {
  adminPin: '2026',
  kioskTitle: 'Home Cafe'
};

// Config Store Methods
const ConfigStore = {
  get: () => {
    return readJSON(CONFIG_FILE, DEFAULT_CONFIG);
  },
  
  save: (config) => {
    const current = readJSON(CONFIG_FILE, DEFAULT_CONFIG);
    const updated = { ...current, ...config };
    writeJSON(CONFIG_FILE, updated);
    return updated;
  }
};

module.exports = {
  MenuStore,
  OrdersStore,
  CategoriesStore,
  ConfigStore,
  UPLOADS_DIR
};
