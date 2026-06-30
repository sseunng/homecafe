import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';

const getApiUrl = (path) => {
  const isDev = window.location.port === '5173';
  const baseUrl = isDev ? `${window.location.protocol}//${window.location.hostname}:3000` : '';
  return `${baseUrl}${path}`;
};

const getInitialOptions = () => [
  {
    id: `opt_temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: '온도',
    type: 'select',
    choices: ['핫', '아이스'],
    default: '핫'
  }
];

export default function AdminView({ onExit }) {
  const { socket, registerRole } = useSocket();

  // Security PIN state
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Navigation tab state: 'orders', 'menu_mgmt', 'system_config'
  const [activeTab, setActiveTab] = useState('orders');

  // Business state
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [kioskTitle, setKioskTitle] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(window.innerWidth < 768);

  // Form states for menu add
  const [newDrinkName, setNewDrinkName] = useState('');
  const [newDrinkDesc, setNewDrinkDesc] = useState('');
  const [newDrinkCategory, setNewDrinkCategory] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Custom Options state inside form
  const [drinkOptions, setDrinkOptions] = useState(getInitialOptions());
  const [customOptName, setCustomOptName] = useState('');
  const [customOptType, setCustomOptType] = useState('select'); // select, count
  const [customOptChoices, setCustomOptChoices] = useState('');

  // System Update authentication states
  const [showUpdatePinModal, setShowUpdatePinModal] = useState(false);
  const [updatePin, setUpdatePin] = useState('');
  const [updatePinError, setUpdatePinError] = useState(false);

  // Sync document title with configured kiosk title
  useEffect(() => {
    if (kioskTitle) {
      document.title = kioskTitle;
    }
  }, [kioskTitle]);

  // Expand completed orders automatically on landscape desktop/tablet screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsHistoryCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set role to admin on mount
  useEffect(() => {
    if (isAuthenticated) {
      registerRole('admin');
      fetchOrders();
      fetchMenu();
      fetchCategories();
      fetchConfig();
    }
  }, [isAuthenticated]);

  // Socket event listener for real-time updates
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Helper sound for new order
    const playNewOrderSound = () => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioContext.currentTime;
        const playTone = (freq, startTime, duration) => {
          const osc = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);
          gainNode.gain.setValueAtTime(0.12, startTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.connect(gainNode);
          gainNode.connect(audioContext.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        };
        playTone(587.33, now, 0.15); // D5
        playTone(659.25, now + 0.08, 0.15); // E5
        playTone(880.00, now + 0.16, 0.3); // A5
      } catch (e) {
        console.warn('Audio feedback failed or blocked by browser rules:', e);
      }
    };

    socket.on('new_order', (newOrder) => {
      console.log('New order received by admin:', newOrder);
      setOrders(prev => [newOrder, ...prev]);
      playNewOrderSound();
    });

    socket.on('order_status_changed', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    socket.on('menu_updated', (updatedMenu) => {
      setMenu(updatedMenu);
    });

    socket.on('categories_updated', (updatedCategories) => {
      setCategories(updatedCategories);
    });

    return () => {
      socket.off('new_order');
      socket.off('order_status_changed');
      socket.off('menu_updated');
      socket.off('categories_updated');
    };
  }, [socket, isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/api/orders'));
      const data = await res.json();
      // Sort: newest first
      setOrders(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
      console.error('Fetch orders failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch(getApiUrl('/api/menu'));
      const data = await res.json();
      setMenu(data);
    } catch (e) {
      console.error('Fetch menu failed:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(getApiUrl('/api/categories'));
      const data = await res.json();
      setCategories(data);
      if (data.length > 0 && !newDrinkCategory) {
        setNewDrinkCategory(data[0]);
      }
    } catch (e) {
      console.error('Fetch categories failed:', e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(getApiUrl('/api/config'));
      const data = await res.json();
      if (data.kioskTitle) {
        setKioskTitle(data.kioskTitle);
      }
    } catch (e) {
      console.error('Fetch config failed:', e);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    const updateData = { kioskTitle };

    if (newPin.trim()) {
      if (newPin.trim().length !== 4 || isNaN(newPin.trim())) {
        alert('비밀번호는 숫자 4자리여야 합니다.');
        return;
      }
      if (newPin.trim() !== confirmPin.trim()) {
        alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
        return;
      }
      updateData.adminPin = newPin.trim();
    }

    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (!res.ok) throw new Error('Update config failed');
      alert('시스템 설정이 저장되었습니다!');
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      alert('설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch(getApiUrl('/api/categories'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      if (!res.ok) throw new Error('Add category failed');
      const data = await res.json();
      setCategories(data);
      setNewCategoryName('');
      if (!newDrinkCategory) {
        setNewDrinkCategory(newCategoryName.trim());
      }
    } catch (e) {
      alert('카테고리 추가에 실패했습니다.');
    }
  };

  const handleDeleteCategory = async (name) => {
    if (!confirm(`정말로 '${name}' 카테고리를 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(getApiUrl(`/api/categories/${encodeURIComponent(name)}`), {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Delete category failed');
      const data = await res.json();
      setCategories(data.categories);
      if (newDrinkCategory === name && data.categories.length > 0) {
        setNewDrinkCategory(data.categories[0]);
      }
    } catch (e) {
      alert('카테고리 삭제에 실패했습니다.');
    }
  };

  const addPresetOption = (presetName) => {
    let newOpt;
    if (presetName === '온도') {
      newOpt = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: '온도',
        type: 'select',
        choices: ['핫', '아이스'],
        default: '핫'
      };
    } else if (presetName === '샷') {
      newOpt = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: '샷',
        type: 'count',
        min: 1,
        max: 4,
        default: 1
      };
    } else if (presetName === '얼음 양') {
      newOpt = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: '얼음 양',
        type: 'select',
        choices: ['보통', '적게', '많이'],
        default: '보통'
      };
    } else if (presetName === '당도 선택') {
      newOpt = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: '당도 선택',
        type: 'select',
        choices: ['기본', '덜 달게', '시럽 추가'],
        default: '기본'
      };
    } else if (presetName === '휘핑 크림') {
      newOpt = {
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: '휘핑 크림',
        type: 'select',
        choices: ['보통', '많이', '없음'],
        default: '보통'
      };
    }

    if (newOpt) {
      if (drinkOptions.some(o => o.name === newOpt.name)) {
        alert('이미 추가된 옵션입니다.');
        return;
      }
      setDrinkOptions(prev => [...prev, newOpt]);
    }
  };

  const addCustomOption = () => {
    if (!customOptName.trim()) {
      alert('옵션명을 입력해 주세요.');
      return;
    }

    let choices = [];
    if (customOptType === 'select') {
      if (!customOptChoices.trim()) {
        alert('선택형 옵션은 최소 1개 이상의 선택 항목이 필요합니다.');
        return;
      }
      choices = customOptChoices.split(',').map(s => s.trim()).filter(Boolean);
      if (choices.length === 0) {
        alert('올바른 선택 항목을 입력해 주세요.');
        return;
      }
    }

    const newOpt = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: customOptName.trim(),
      type: customOptType,
      ...(customOptType === 'select' ? { choices, default: choices[0] } : { min: 0, max: 4, default: 0 })
    };

    if (drinkOptions.some(o => o.name === newOpt.name)) {
      alert('이미 존재하는 옵션명입니다.');
      return;
    }

    setDrinkOptions(prev => [...prev, newOpt]);
    setCustomOptName('');
    setCustomOptChoices('');
  };

  const removeDrinkOption = (id) => {
    setDrinkOptions(prev => prev.filter(o => o.id !== id));
  };

  // PIN code keypad press
  const handleKeyPress = async (num) => {
    setPinError(false);
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        try {
          const res = await fetch(getApiUrl('/api/admin/verify-pin'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: nextPin })
          });
          if (!res.ok) throw new Error('PIN verification failed');
          const data = await res.json();
          if (data.success) {
            setIsAuthenticated(true);
          } else {
            setTimeout(() => {
              setPinError(true);
              setPin('');
            }, 150);
          }
        } catch (e) {
          alert('비밀번호 검증 중 오류가 발생했습니다.');
          setPin('');
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  // Status transitions: pending -> preparing -> completed
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(getApiUrl(`/api/orders/${orderId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
    } catch (e) {
      alert('상태 업데이트에 실패했습니다.');
    }
  };

  // Menu management methods
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    const finalCategory = newDrinkCategory || (categories.length > 0 ? categories[0] : '커피 (Coffee)');
    if (!newDrinkName || !finalCategory) {
      alert('음료명과 카테고리는 필수 항목입니다.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('name', newDrinkName);
      formData.append('description', newDrinkDesc);
      formData.append('category', finalCategory);
      formData.append('options', JSON.stringify(drinkOptions));
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      const res = await fetch(getApiUrl('/api/menu'), {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Add menu failed');

      // Reset form
      setNewDrinkName('');
      setNewDrinkDesc('');
      setDrinkOptions(getInitialOptions());
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      alert('신규 음료가 등록되었습니다!');
      fetchMenu();
    } catch (e) {
      alert('음료 등록에 실패했습니다.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMenuItem = async (id) => {
    if (!confirm('정말로 이 메뉴를 완전히 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(getApiUrl(`/api/menu/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setMenu(prev => prev.filter(item => item.id !== id));
    } catch (e) {
      alert('메뉴 삭제에 실패했습니다.');
    }
  };

  const moveCategory = async (cat, direction) => {
    const index = categories.indexOf(cat);
    if (index === -1) return;

    const newCategories = [...categories];
    if (direction === 'up' && index > 0) {
      newCategories[index] = newCategories[index - 1];
      newCategories[index - 1] = cat;
    } else if (direction === 'down' && index < categories.length - 1) {
      newCategories[index] = newCategories[index + 1];
      newCategories[index + 1] = cat;
    } else {
      return;
    }

    setCategories(newCategories);
    try {
      const res = await fetch(getApiUrl('/api/categories/reorder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: newCategories })
      });
      if (!res.ok) throw new Error('Reorder failed');
    } catch (e) {
      alert('카테고리 순서 변경에 실패했습니다.');
      fetchCategories();
    }
  };

  const moveMenuItem = async (id, direction) => {
    const index = menu.findIndex(item => item.id === id);
    if (index === -1) return;

    const newMenu = [...menu];
    if (direction === 'up' && index > 0) {
      newMenu[index] = newMenu[index - 1];
      newMenu[index - 1] = menu[index];
    } else if (direction === 'down' && index < menu.length - 1) {
      newMenu[index] = newMenu[index + 1];
      newMenu[index + 1] = menu[index];
    } else {
      return;
    }

    setMenu(newMenu);
    try {
      const res = await fetch(getApiUrl('/api/menu/reorder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuIds: newMenu.map(item => item.id) })
      });
      if (!res.ok) throw new Error('Reorder failed');
    } catch (e) {
      alert('메뉴 순서 변경에 실패했습니다.');
      fetchMenu();
    }
  };

  const handleUpdatePinKeyPress = async (num) => {
    setUpdatePinError(false);
    if (updatePin.length < 4) {
      const nextPin = updatePin + num;
      setUpdatePin(nextPin);
      if (nextPin.length === 4) {
        try {
          setLoading(true);
          const res = await fetch(getApiUrl('/api/system/update'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: nextPin })
          });

          const data = await res.json();
          if (!res.ok) {
            // Set update PIN error only on 401 Unauthorized password mismatches
            if (res.status === 401) {
              setUpdatePinError(true);
            } else {
              setUpdatePinError(false);
            }
            setUpdatePin('');
            throw new Error(data.error || '업데이트 요청 실패');
          }

          alert(data.message || '업데이트가 시작되었습니다. 약 1분 후 페이지를 새로고침해 주세요.');
          setShowUpdatePinModal(false);
          setUpdatePin('');
        } catch (e) {
          alert(`업데이트 실패: ${e.message}`);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleSystemUpdate = () => {
    setShowUpdatePinModal(true);
    setUpdatePin('');
    setUpdatePinError(false);
  };

  const handleToggleAvailability = async (id, currentAvailable) => {
    try {
      const res = await fetch(getApiUrl(`/api/menu/${id}/availability`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !currentAvailable })
      });
      if (!res.ok) throw new Error('Toggle availability failed');
      const updated = await res.json();
      setMenu(prev => prev.map(item => item.id === id ? updated : item));
    } catch (e) {
      alert('품절 여부 변경에 실패했습니다.');
    }
  };

  // Separate orders by status
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');

  // Show completed/cancelled/picked_up orders for today
  const historyOrders = orders.filter(o => o.status === 'completed' || o.status === 'cancelled' || o.status === 'picked_up');

  // Format date helper
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // --- SECURITY PIN ENTRY LOCK SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="admin-lock-screen">
        <button
          className="header-back-btn"
          style={{ position: 'absolute', top: '20px', left: '20px' }}
          onClick={onExit}
        >
          ←
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div className="pin-title">관리자 암호 입력</div>
          <p style={{ color: pinError ? 'var(--toss-red)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: pinError ? 'bold' : 'normal' }}>
            {pinError ? '암호가 다릅니다. 다시 입력하세요.' : '4자리 암호(PIN)를 입력해 주세요.'}
          </p>
        </div>

        <div className="pin-dots">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`pin-dot ${i < pin.length ? 'active' : ''}`}
              style={{ borderColor: pinError ? 'var(--toss-red)' : 'var(--border-color)' }}
            />
          ))}
        </div>

        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button key={num} className="pin-key" onClick={() => handleKeyPress(num)}>
              {num}
            </button>
          ))}
          <button className="pin-key pin-key-clear" onClick={handleClear}>초기화</button>
          <button className="pin-key" onClick={() => handleKeyPress(0)}>0</button>
          <button className="pin-key pin-key-clear" onClick={handleBackspace}>지우기</button>
        </div>
      </div>
    );
  }

  // --- MAIN ADMIN MANAGEMENT VIEW ---
  return (
    <div className="app-container" style={{ backgroundColor: 'var(--bg-secondary)', minHeight: '100vh' }}>
      <header className="app-header">
        <div className="header-title-container">
          <span className="header-title">Host Dashboard</span>
        </div>
        <button
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '30px', flex: 'none', width: 'fit-content' }}
          onClick={() => {
            registerRole('guest'); // Reset back to guest socket mapping
            onExit();
          }}
        >
          손님 모드로
        </button>
      </header>

      {/* Navigation tabs between Order tracking, Menu editing, and System configuration */}
      <nav className="admin-nav">
        <button
          className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          실시간 주문 현황 ({pendingOrders.length + preparingOrders.length})
        </button>
        <button
          className={`admin-nav-item ${activeTab === 'menu_mgmt' ? 'active' : ''}`}
          onClick={() => setActiveTab('menu_mgmt')}
        >
          메뉴 관리
        </button>
        <button
          className={`admin-nav-item ${activeTab === 'system_config' ? 'active' : ''}`}
          onClick={() => setActiveTab('system_config')}
        >
          시스템 설정
        </button>
      </nav>

      <div className="admin-content">

        {/* TAB 1: REAL-TIME ORDERS BOARD */}
        {activeTab === 'orders' && (
          <div className="order-board">

            {/* COLUMN A: 주문 대기 */}
            <div className="board-column">
              <div className="column-header">
                <span className="column-title">주문 대기</span>
                <span className="column-count">{pendingOrders.length}</span>
              </div>

              <div className="order-cards-list">
                {pendingOrders.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px 0' }}>대기 중인 주문이 없습니다.</p>
                ) : (
                  pendingOrders.map(order => (
                    <div key={order.id} className="order-admin-card">
                      <div className="order-admin-header">
                        <span className="order-admin-num">주문 #{order.orderNumber} {order.nickname ? `(${order.nickname})` : ''}</span>
                        <span className="order-admin-time">{formatTime(order.createdAt)}</span>
                      </div>

                      <div className="order-admin-items">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="order-admin-item-row">
                            <span className="order-admin-item-name">{item.name}</span>
                            <span className="order-admin-item-qty">
                              {item.quantity}잔 <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({item.options})</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="order-admin-actions" style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button
                          className="btn-primary btn-small"
                          style={{ flex: 2 }}
                          onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        >
                          주문 수락
                        </button>
                        <button
                          className="btn-danger btn-small"
                          style={{ flex: 1, backgroundColor: 'var(--toss-red-light)', color: 'var(--toss-red)', boxShadow: 'none' }}
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN B: 제조 중 (Preparing) */}
            <div className="board-column" style={{ borderColor: 'var(--toss-blue-light)' }}>
              <div className="column-header">
                <span className="column-title" style={{ color: 'var(--toss-blue)' }}>제조중</span>
                <span className="column-count" style={{ backgroundColor: 'var(--toss-blue-light)', color: 'var(--toss-blue)' }}>{preparingOrders.length}</span>
              </div>

              <div className="order-cards-list">
                {preparingOrders.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px 0' }}>제조 중인 음료가 없습니다.</p>
                ) : (
                  preparingOrders.map(order => (
                    <div key={order.id} className="order-admin-card" style={{ borderLeft: '4px solid var(--toss-blue)' }}>
                      <div className="order-admin-header">
                        <span className="order-admin-num">주문 #{order.orderNumber} {order.nickname ? `(${order.nickname})` : ''}</span>
                        <span className="order-admin-time">{formatTime(order.createdAt)}</span>
                      </div>

                      <div className="order-admin-items">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="order-admin-item-row">
                            <span className="order-admin-item-name">{item.name}</span>
                            <span className="order-admin-item-qty">
                              {item.quantity}잔 <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({item.options})</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="order-admin-actions">
                        <button
                          className="btn-danger btn-small"
                          style={{ flex: 'none', width: '60px', padding: '10px 0' }}
                          onClick={() => handleUpdateStatus(order.id, 'cancelled')}
                        >
                          취소
                        </button>
                        <button
                          className="btn-primary btn-small"
                          style={{ backgroundColor: 'var(--toss-green)', boxShadow: 'none' }}
                          onClick={() => handleUpdateStatus(order.id, 'completed')}
                        >
                          제조 완료 (알림 전송)
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* COLUMN C: 완료 이력 (Completed History) */}
            <div className="board-column completed-column" style={{ opacity: 0.85 }}>
              <div
                className="column-header collapsible-header"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsHistoryCollapsed(!isHistoryCollapsed);
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="column-title">완료된 주문</span>
                  <span className="column-count">{historyOrders.length}</span>
                </div>
                <span className="collapse-toggle-icon">
                  {isHistoryCollapsed ? '▼' : '▲'}
                </span>
              </div>

              {!isHistoryCollapsed && (
                <div className="order-cards-list">
                  {historyOrders.length === 0 ? (
                    <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', padding: '16px 0' }}>완료된 이력이 없습니다.</p>
                  ) : (
                    historyOrders.map(order => (
                      <div key={order.id} className="order-admin-card" style={{ opacity: order.status === 'picked_up' ? 0.6 : 0.8 }}>
                        <div className="order-admin-header">
                          <span>주문 #{order.orderNumber} {order.nickname ? `(${order.nickname})` : ''}</span>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: order.status === 'completed' ? 'var(--toss-green)' : order.status === 'picked_up' ? 'var(--text-secondary)' : 'var(--toss-red)' }}>
                            {order.status === 'completed' && '제조 완료'}
                            {order.status === 'picked_up' && '수령 완료'}
                            {order.status === 'cancelled' && '주문 취소됨'}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {order.items.map(i => `${i.name} ${i.quantity}잔`).join(', ')}
                        </div>
                        {order.status === 'completed' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button
                              className="btn-primary btn-small"
                              style={{ padding: '6px 12px', fontSize: '12px', width: 'fit-content' }}
                              onClick={() => handleUpdateStatus(order.id, 'picked_up')}
                            >
                              수령 확인
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: MENU CONFIGURATION */}
        {activeTab === 'menu_mgmt' && (
          <div>

            {/* Category Management Block */}
            <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '24px' }}>
              <div style={{ fontWeight: '800', fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>카테고리 관리</div>

              <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="새 카테고리명 (예: 에이드)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  style={{ flex: 1, padding: '10px' }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '10px 16px', flex: 'none', fontSize: '14px' }}>
                  추가
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categories.map((cat, idx) => (
                  <div
                    key={cat}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-primary)',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>{cat}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        disabled={idx === 0}
                        onClick={() => moveCategory(cat, 'up')}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', cursor: idx === categories.length - 1 ? 'not-allowed' : 'pointer' }}
                        disabled={idx === categories.length - 1}
                        onClick={() => moveCategory(cat, 'down')}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', backgroundColor: 'var(--toss-red)', color: '#fff', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleDeleteCategory(cat)}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Form to add a new drink */}
            <form className="menu-editor-form" onSubmit={handleAddMenuItem}>
              <div className="form-title">신규 음료 추가</div>

              <div className="form-group">
                <label>음료명</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="예: 돌체 콜드브루"
                  value={newDrinkName}
                  onChange={(e) => setNewDrinkName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>설명 (선택)</label>
                <textarea
                  className="form-control"
                  placeholder="예: 깔끔한 콜드브루에 달콤한 연유가 가득한 음료"
                  value={newDrinkDesc}
                  onChange={(e) => setNewDrinkDesc(e.target.value)}
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>카테고리</label>
                <select
                  className="form-control"
                  value={newDrinkCategory}
                  onChange={(e) => setNewDrinkCategory(e.target.value)}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Option Builder Section */}
              <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-primary)' }}>음료 옵션 설정</label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0' }}>
                  {drinkOptions.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>설정된 맞춤 옵션이 없습니다. (미지정 시 기본 온도/당도 템플릿이 적용됩니다)</span>
                  ) : (
                    drinkOptions.map(opt => (
                      <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                          {opt.name} <span style={{ fontSize: '11px', color: 'var(--toss-blue)', fontWeight: 'normal' }}>({opt.type === 'select' ? '선택형' : '수량형'})</span>
                          {opt.type === 'select' && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 'normal' }}> : {opt.choices.join(', ')}</span>}
                        </span>
                        <button type="button" style={{ color: 'var(--toss-red)', fontSize: '12px', fontWeight: 'bold' }} onClick={() => removeDrinkOption(opt.id)}>삭제</button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '8px 0' }}>
                  {['온도', '샷', '얼음 양', '당도 선택', '휘핑 크림'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className="category-tab"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      onClick={() => addPresetOption(preset)}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>직접 옵션 만들기</span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-control"
                      style={{ flex: 2, padding: '8px', fontSize: '13px' }}
                      placeholder="옵션명 (예: 우유 선택)"
                      value={customOptName}
                      onChange={(e) => setCustomOptName(e.target.value)}
                    />
                    <select
                      className="form-control"
                      style={{ flex: 1, padding: '8px', fontSize: '13px' }}
                      value={customOptType}
                      onChange={(e) => setCustomOptType(e.target.value)}
                    >
                      <option value="select">선택형 (버튼)</option>
                      <option value="count">수량형 (카운터)</option>
                    </select>
                  </div>

                  {customOptType === 'select' && (
                    <input
                      type="text"
                      className="form-control"
                      style={{ padding: '8px', fontSize: '12px' }}
                      placeholder="옵션 선택 항목 (쉼표로 구분, 예: 일반우유, 저지방, 두유)"
                      value={customOptChoices}
                      onChange={(e) => setCustomOptChoices(e.target.value)}
                    />
                  )}

                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '8px', fontSize: '13px', borderRadius: '6px' }}
                    onClick={addCustomOption}
                  >
                    옵션 리스트에 추가
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>음료 이미지</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  id="admin-image-file-input"
                />
                <div
                  className="image-upload-area"
                  onClick={() => document.getElementById('admin-image-file-input').click()}
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="preview-uploaded-image" />
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>이미지 변경하려면 클릭</span>
                    </>
                  ) : (
                    <>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                      <span style={{ fontSize: '13px', fontWeight: '500' }}>이미지 업로드하기</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>여기를 클릭해 이미지를 선택하세요</span>
                    </>
                  )}
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? '추가 중...' : '메뉴 추가하기'}
              </button>
            </form>

            {/* List of current menu items */}
            <div style={{ fontWeight: '800', fontSize: '16px', margin: '20px 0 12px 0' }}>등록된 메뉴 ({menu.length})</div>

            <div className="menu-editor-list">
              {menu.map(item => (
                <div key={item.id} className="menu-editor-item" style={{ opacity: item.available ? 1 : 0.6 }}>
                  {item.image ? (
                    <img
                      src={getApiUrl(item.image)}
                      alt={item.name}
                      className="menu-editor-thumbnail"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      className="menu-editor-thumbnail"
                      style={{
                        background: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, color: 'var(--text-secondary)' }}>
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                        <line x1="6" y1="2" x2="6" y2="4"></line>
                        <line x1="10" y1="2" x2="10" y2="4"></line>
                        <line x1="14" y1="2" x2="14" y2="4"></line>
                      </svg>
                    </div>
                  )}

                  <div className="menu-editor-details">
                    <div className="menu-editor-name">{item.name}</div>
                    <div className="menu-editor-category">{item.category}</div>
                  </div>

                  {/* Toggle availability (품절 처리) */}
                  <div
                    className="switch-container"
                    onClick={() => handleToggleAvailability(item.id, item.available)}
                  >
                    <span className="switch-label">{item.available ? '판매중' : '품절'}</span>
                    <div className={`switch-track ${item.available ? 'active' : ''}`}>
                      <div className="switch-thumb"></div>
                    </div>
                  </div>

                  {/* Reorder Buttons (▲/▼) */}
                  <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => moveMenuItem(item.id, 'up')}
                      title="위로 이동"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}
                      onClick={() => moveMenuItem(item.id, 'down')}
                      title="아래로 이동"
                    >
                      ▼
                    </button>
                  </div>

                  <button
                    className="delete-icon-btn"
                    onClick={() => handleDeleteMenuItem(item.id)}
                    title="메뉴 삭제"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* TAB 3: SYSTEM CONFIGURATION */}
        {activeTab === 'system_config' && (
          <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: '800', fontSize: '16px' }}>시스템 설정</div>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>버전 v1.3.2</span>
            </div>

            <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>키오스크 상단 타이틀</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="예: Home Cafe"
                  value={kioskTitle}
                  onChange={(e) => setKioskTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>새 비밀번호 (숫자 4자리)</label>
                  <input
                    type="password"
                    maxLength="4"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    className="form-control"
                    placeholder="변경 안 함"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>비밀번호 확인</label>
                  <input
                    type="password"
                    maxLength="4"
                    pattern="[0-9]*"
                    inputMode="numeric"
                    className="form-control"
                    placeholder="변경 안 함"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '8px' }}>
                {loading ? '설정 저장 중...' : '설정 저장하기'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '24px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '8px', color: 'var(--text-secondary)' }}>시스템 업데이트</div>
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px', lineBreak: 'anywhere' }}>
                GitHub 원격 저장소에서 최신 소스코드를 다운로드하고 도커 환경을 재생성합니다. 업데이트가 완료되면 시스템이 자동으로 재시작되며, 현재 페이지를 새로고침하셔야 합니다.
              </p>
              <button
                type="button"
                className="btn-danger"
                style={{ padding: '10px 16px', fontSize: '13px', width: 'fit-content' }}
                onClick={handleSystemUpdate}
                disabled={loading}
              >
                {loading ? '업데이트 진행 중...' : '시스템 업데이트 실행'}
              </button>
            </div>
          </div>
        )}

        {/* System Update PIN Modal Overlay */}
        {showUpdatePinModal && (
          <div className="nickname-modal-overlay" style={{ zIndex: 6000 }}>
            <div className="nickname-modal-card" style={{ maxWidth: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="nickname-modal-title" style={{ textAlign: 'center' }}>업데이트 PIN 입력</div>
              <p style={{ color: updatePinError ? 'var(--toss-red)' : 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 16px 0', textAlign: 'center' }}>
                {updatePinError ? '비밀번호가 올바르지 않습니다.' : '관리자 4자리 암호를 입력하세요.'}
              </p>

              <div className="pin-dots" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px', width: '100%' }}>
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className={`pin-dot ${i < updatePin.length ? 'active' : ''}`}
                    style={{ borderColor: updatePinError ? 'var(--toss-red)' : 'var(--border-color)' }}
                  />
                ))}
              </div>

              <div className="pin-keypad" style={{ gap: '8px', gridTemplateColumns: 'repeat(3, 1fr)', width: '100%', justifyItems: 'center' }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <button key={num} type="button" className="pin-key" style={{ width: '60px', height: '60px', fontSize: '20px' }} onClick={() => handleUpdatePinKeyPress(num)}>
                    {num}
                  </button>
                ))}
                <button type="button" className="pin-key pin-key-clear" style={{ width: '60px', height: '60px', fontSize: '14px' }} onClick={() => setUpdatePin('')}>초기화</button>
                <button type="button" className="pin-key" style={{ width: '60px', height: '60px', fontSize: '20px' }} onClick={() => handleUpdatePinKeyPress(0)}>0</button>
                <button type="button" className="pin-key pin-key-clear" style={{ width: '60px', height: '60px', fontSize: '14px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} onClick={() => setShowUpdatePinModal(false)}>취소</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
