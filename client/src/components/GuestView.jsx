import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

// Helper to resolve API URLs
const getApiUrl = (path) => {
  const isDev = window.location.port === '5173';
  const baseUrl = isDev ? `${window.location.protocol}//${window.location.hostname}:3000` : '';
  return `${baseUrl}${path}`;
};

// Fallback category gradient helper
const getCategoryGradientClass = (category) => {
  const cat = category.toLowerCase();
  if (cat.includes('커피') || cat.includes('coffee')) return 'gradient-coffee';
  if (cat.includes('논커피') || cat.includes('non-coffee') || cat.includes('ade')) return 'gradient-non-coffee';
  if (cat.includes('티') || cat.includes('tea') || cat.includes('herb')) return 'gradient-tea';
  if (cat.includes('디저트') || cat.includes('dessert') || cat.includes('sweet')) return 'gradient-dessert';
  return 'gradient-default';
};

// Fallback Emoji helper
const getCategoryEmoji = (category) => {
  return '';
};

export default function GuestView({ onAdminEnter }) {
  const { socket, guestId } = useSocket();
  
  // App state
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState(['전체']);
  const [kioskTitle, setKioskTitle] = useState('Home Cafe');
  const [selectedCategory, setSelectedCategory] = useState('전체');
  const [loading, setLoading] = useState(true);
  
  // Shopping Cart state
  const [cart, setCart] = useState([]);
  
  // active views: 'menu', 'cart', 'order_status'
  const [currentView, setCurrentView] = useState('menu'); 
  const [activeOrder, setActiveOrder] = useState(null);
  
  // Bottom Sheet Selection State
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [tempOption, setTempOption] = useState('Ice'); // Hot, Ice
  const [sweetOption, setSweetOption] = useState('기본'); // 기본, 덜 달게, 시럽 추가
  const [customOptions, setCustomOptions] = useState({});
  
  // Nickname prompt state
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [pendingItemsToOrder, setPendingItemsToOrder] = useState(null);
  
  // Toast Alert State
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Hidden admin access trigger state
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [lastLogoClickTime, setLastLogoClickTime] = useState(0);

  // Sync document title with configured kiosk title
  useEffect(() => {
    if (kioskTitle) {
      document.title = kioskTitle;
    }
  }, [kioskTitle]);

  // Fetch menu on load
  useEffect(() => {
    fetchMenu();
    fetchConfig();
    
    // Check if there's an existing active order in localStorage
    const savedOrder = localStorage.getItem('homecafe_kiosk_active_order');
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder);
        // Fetch current status from server to ensure it is not stale
        fetch(getApiUrl(`/api/orders/${parsed.id}`))
          .then(res => {
            if (res.status === 404) {
              // Not found (e.g. database reset)
              localStorage.removeItem('homecafe_kiosk_active_order');
              setActiveOrder(null);
              setCurrentView('menu');
            } else {
              return res.json();
            }
          })
          .then(serverOrder => {
            if (serverOrder) {
              if (serverOrder.status === 'completed' || serverOrder.status === 'cancelled' || serverOrder.status === 'picked_up') {
                // Already done, picked up or cancelled! Clear it.
                localStorage.removeItem('homecafe_kiosk_active_order');
                setActiveOrder(null);
                setCurrentView('menu');
              } else {
                // Still active (pending or preparing)
                setActiveOrder(serverOrder);
                localStorage.setItem('homecafe_kiosk_active_order', JSON.stringify(serverOrder));
                setCurrentView('order_status');
              }
            }
          })
          .catch(err => {
            // Network fallback: use local storage copy
            setActiveOrder(parsed);
            setCurrentView('order_status');
          });
      } catch (e) {
        localStorage.removeItem('homecafe_kiosk_active_order');
      }
    }
  }, []);

  // Listen for socket menu updates & order status updates
  useEffect(() => {
    if (!socket) return;

    socket.on('menu_updated', (updatedMenu) => {
      setMenu(updatedMenu);
    });

    socket.on('categories_updated', (updatedCategories) => {
      setCategories(['전체', ...updatedCategories]);
    });

    socket.on('config_updated', (data) => {
      if (data.kioskTitle) {
        setKioskTitle(data.kioskTitle);
      }
    });

    socket.on('order_status_updated', (updatedOrder) => {
      if (activeOrder && activeOrder.id === updatedOrder.id) {
        setActiveOrder(updatedOrder);
        localStorage.setItem('homecafe_kiosk_active_order', JSON.stringify(updatedOrder));
        
        // If completed, cancelled, or picked up, remove from local persistence after a delay or keep it
        if (updatedOrder.status === 'completed' || updatedOrder.status === 'cancelled' || updatedOrder.status === 'picked_up') {
          // Clear active order so they can place a new one later
          localStorage.removeItem('homecafe_kiosk_active_order');
        }
      }
    });

    return () => {
      socket.off('menu_updated');
      socket.off('categories_updated');
      socket.off('config_updated');
      socket.off('order_status_updated');
    };
  }, [socket, activeOrder]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/api/menu'));
      const data = await res.json();
      setMenu(data);
      await fetchCategories();
    } catch (e) {
      console.error('Fetch menu failed:', e);
    } finally {
      setLoading(false);
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

  const fetchCategories = async () => {
    try {
      const res = await fetch(getApiUrl('/api/categories'));
      const data = await res.json();
      setCategories(['전체', ...data]);
    } catch (e) {
      console.error('Fetch categories failed:', e);
    }
  };

  const handleLogoClick = () => {
    const now = Date.now();
    // Reset count if delay is more than 3 seconds
    if (now - lastLogoClickTime > 3000) {
      setLogoClickCount(1);
    } else {
      const newCount = logoClickCount + 1;
      setLogoClickCount(newCount);
      if (newCount >= 5) {
        onAdminEnter(); // Trigger PIN popup
        setLogoClickCount(0);
      }
    }
    setLastLogoClickTime(now);
  };

  const openBottomSheet = (item) => {
    if (!item.available) return;
    setSelectedItem(item);
    setQuantity(1);
    setTempOption('Ice');
    setSweetOption('기본');

    // Initialize custom options selection
    const initialOpts = {};
    if (item.options && Array.isArray(item.options)) {
      item.options.forEach(opt => {
        initialOpts[opt.name] = opt.default;
      });
    }
    setCustomOptions(initialOpts);
  };

  const closeBottomSheet = () => {
    setSelectedItem(null);
  };

  // Toast Helper
  const triggerToast = (message) => {
    setToastMessage(message);
    setShowToast(true);
    // Auto-dismiss after 4 seconds
    const timer = setTimeout(() => {
      setShowToast(false);
    }, 4000);
    return () => clearTimeout(timer);
  };

  // Add to cart
  const handleAddToCart = (directCheckout = false) => {
    if (!selectedItem) return;

    let optionsStr = '';
    if (selectedItem.options && selectedItem.options.length > 0) {
      optionsStr = selectedItem.options.map(opt => {
        if (opt.type === 'select') {
          return `${opt.name}: ${customOptions[opt.name] || opt.default}`;
        } else {
          const val = customOptions[opt.name] || 0;
          return `${opt.name} (+${val})`;
        }
      }).join(', ');
    } else {
      optionsStr = `${tempOption === 'Ice' ? '아이스' : '핫'}, 당도: ${sweetOption}`;
    }

    const cartItem = {
      id: `${selectedItem.id}_${Date.now()}`,
      menuId: selectedItem.id,
      name: selectedItem.name,
      image: selectedItem.image,
      category: selectedItem.category,
      quantity,
      options: optionsStr
    };

    if (directCheckout) {
      // Direct checkout: add to cart, close bottom sheet, and open cart view
      setCart(prev => [...prev, cartItem]);
      closeBottomSheet();
      setCurrentView('cart');
    } else {
      // Standard cart add
      setCart(prev => [...prev, cartItem]);
      closeBottomSheet();
      triggerToast(`장바구니에 ${selectedItem.name}을(를) 담았습니다!`);
    }
  };

  const updateCartQty = (id, change) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeCartItem = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleSetNickname = (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('닉네임을 입력해 주시거나 건너뛰기를 눌러주세요.');
      return;
    }
    sessionStorage.setItem('homecafe_nickname_status', 'set');
    sessionStorage.setItem('homecafe_nickname', trimmed);
    setShowNicknameModal(false);
    if (pendingItemsToOrder) {
      handlePlaceOrder(pendingItemsToOrder, true);
      setPendingItemsToOrder(null);
    }
  };

  const handleSkipNickname = () => {
    sessionStorage.setItem('homecafe_nickname_status', 'skipped');
    setShowNicknameModal(false);
    if (pendingItemsToOrder) {
      handlePlaceOrder(pendingItemsToOrder, true);
      setPendingItemsToOrder(null);
    }
  };

  // Place Order API call
  const handlePlaceOrder = async (itemsToOrder = cart, bypassNicknameCheck = false) => {
    if (itemsToOrder.length === 0) return;

    // Check session status of nickname
    const nicknameStatus = sessionStorage.getItem('homecafe_nickname_status');
    const savedNickname = sessionStorage.getItem('homecafe_nickname') || '';

    if (!nicknameStatus && !bypassNicknameCheck) {
      setPendingItemsToOrder(itemsToOrder);
      setShowNicknameModal(true);
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(getApiUrl('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          nickname: nicknameStatus === 'set' ? savedNickname : '',
          items: itemsToOrder.map(item => ({
            menuId: item.menuId,
            name: item.name,
            quantity: item.quantity,
            options: item.options
          }))
        })
      });

      if (!res.ok) throw new Error('Order submission failed');
      const order = await res.json();
      
      setActiveOrder(order);
      localStorage.setItem('homecafe_kiosk_active_order', JSON.stringify(order));
      setCart([]); // Clear cart
      setCurrentView('order_status');
    } catch (e) {
      alert('주문 전송에 실패했습니다. 다시 시도해 주세요.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const cancelActiveOrderLocally = () => {
    localStorage.removeItem('homecafe_kiosk_active_order');
    setActiveOrder(null);
    setCurrentView('menu');
  };

  // Helper to clean category name for comparison (stripping emojis/spaces)
  const cleanCategory = (str) => {
    if (!str) return '';
    return str.replace(/[^\w\sㄱ-힣]/g, '').trim();
  };

  // Filtered menu
  const filteredMenu = selectedCategory === '전체'
    ? menu
    : menu.filter(item => cleanCategory(item.category) === cleanCategory(selectedCategory));

  // Sort and group menu items if '전체' is selected
  const getSortedMenu = () => {
    if (selectedCategory !== '전체') {
      return filteredMenu;
    }
    return [...filteredMenu].sort((a, b) => {
      const indexA = categories.findIndex(cat => cleanCategory(cat) === cleanCategory(a.category));
      const indexB = categories.findIndex(cat => cleanCategory(cat) === cleanCategory(b.category));
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const sortedMenuItems = getSortedMenu();

  return (
    <div className="app-container">
      {/* 1. APP HEADER */}
      <header className="app-header">
        <div className="header-title-container" onClick={handleLogoClick}>
          <span className="header-title">{kioskTitle}</span>
        </div>
        
        <div className="header-actions">
          {activeOrder && currentView !== 'order_status' && (
            <button 
              className="header-btn" 
              onClick={() => setCurrentView('order_status')}
              title="현재 주문 현황"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>
          )}
          {currentView === 'menu' ? (
            <button className="header-btn" onClick={() => setCurrentView('cart')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {cart.length > 0 && <span className="badge">{cart.reduce((a, b) => a + b.quantity, 0)}</span>}
            </button>
          ) : (
            <button className="header-back-btn" onClick={() => setCurrentView('menu')}>
              ←
            </button>
          )}
        </div>
      </header>

      {/* 2. MENU MAIN VIEW */}
      {currentView === 'menu' && (
        <>
          {/* Category Scroller */}
          <div className="category-tabs">
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-tab ${cleanCategory(selectedCategory) === cleanCategory(cat) ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Menu Items List */}
          <div className="menu-list-container">
            {loading ? (
              <div className="loading-spinner-container">
                <div className="spinner"></div>
                <p>메뉴를 불러오는 중...</p>
              </div>
            ) : sortedMenuItems.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">등록된 메뉴가 없습니다.</div>
              </div>
            ) : (
              <div className="menu-grid">
                {(() => {
                  let lastCategory = null;
                  return sortedMenuItems.map(item => {
                    const showHeader = item.category !== lastCategory;
                    lastCategory = item.category;

                    return (
                      <React.Fragment key={item.id}>
                        {showHeader && (
                          <div className="category-section-header" style={{ gridColumn: '1 / -1' }}>
                            <span className="category-header-name">{item.category}</span>
                          </div>
                        )}
                        <div
                          className={`menu-card ${!item.available ? 'sold-out' : ''}`}
                          onClick={() => openBottomSheet(item)}
                        >
                          {!item.available && (
                            <div className="sold-out-overlay">품 절 (Sold Out)</div>
                          )}
                          <div className="menu-card-image-container">
                            {item.image ? (
                              <img 
                                src={getApiUrl(item.image)} 
                                alt={item.name} 
                                className="menu-card-image"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className={`menu-card-image-fallback ${getCategoryGradientClass(item.category)}`}
                              style={{ display: item.image ? 'none' : 'flex' }}
                            >
                              {getCategoryEmoji(item.category)}
                            </div>
                          </div>

                          <div className="menu-card-info">
                            <div className="menu-card-name">{item.name}</div>
                            {item.description && (
                              <div className="menu-card-description">{item.description}</div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </>
      )}

      {/* 3. CART VIEW */}
      {currentView === 'cart' && (
        <div className="cart-page">
          <div className="cart-title-section">
            <h2>장바구니</h2>
          </div>

          {cart.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
              <div className="empty-title">장바구니가 비어 있습니다</div>
              <div className="empty-desc">맛있는 음료를 담아보세요!</div>
              <button 
                className="btn-primary" 
                style={{ marginTop: '24px', padding: '12px 24px', flex: 'none' }} 
                onClick={() => setCurrentView('menu')}
              >
                메뉴 보러 가기
              </button>
            </div>
          ) : (
            <>
              <div className="cart-items-list">
                {cart.map(item => (
                  <div key={item.id} className="cart-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="cart-item-details">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-options">
                        {item.options}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="quantity-controls" style={{ margin: 0 }}>
                        <button className="qty-btn" onClick={() => updateCartQty(item.id, -1)}>-</button>
                        <span className="qty-number">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => updateCartQty(item.id, 1)}>+</button>
                      </div>
                      
                      <button 
                        className="cart-item-remove-icon" 
                        onClick={() => removeCartItem(item.id)}
                        title="삭제"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="cart-total-footer">
                <div className="cart-total-row">
                  <span>총 주문 수량</span>
                  <span>{cart.reduce((a, b) => a + b.quantity, 0)}잔</span>
                </div>
                <div className="cart-total-row" style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                  <span>결제 금액</span>
                  <span className="cart-free-tag">무료</span>
                </div>
                <button className="btn-primary btn-full" onClick={() => handlePlaceOrder()}>
                  주문하기
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 4. ACTIVE ORDER STATUS VIEW */}
      {currentView === 'order_status' && (
        <div className="checkout-page">
          {activeOrder ? (
            <>
              <div className="success-checkmark">✓</div>
              <h2 className="checkout-title">{activeOrder.nickname ? `${activeOrder.nickname}님, 주문이 접수되었습니다!` : '주문이 접수되었습니다!'}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>주문 현황을 실시간으로 확인하실 수 있습니다.</p>

              <div className="order-number-card">
                <div className="order-num-label">{activeOrder.nickname ? '호출 이름' : '내 주문 번호'}</div>
                <div className="order-num-value">{activeOrder.nickname ? `${activeOrder.nickname}님` : `#${activeOrder.orderNumber}`}</div>
                
                {/* Real-time Order Status Badge */}
                <div className={`status-badge ${
                  activeOrder.status === 'pending' ? 'status-pending' :
                  activeOrder.status === 'preparing' ? 'status-preparing' :
                  activeOrder.status === 'completed' ? 'status-completed' : 'status-cancelled'
                }`}>
                  {activeOrder.status === 'pending' && '주문 대기 중'}
                  {activeOrder.status === 'preparing' && '제조중'}
                  {activeOrder.status === 'completed' && '제조 완료'}
                  {activeOrder.status === 'cancelled' && '주문 취소됨'}
                </div>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className="btn-primary btn-full" 
                  onClick={() => setCurrentView('menu')}
                >
                  다른 음료도 살펴보기
                </button>

                {(activeOrder.status === 'completed' || activeOrder.status === 'cancelled') && (
                  <button 
                    className="btn-secondary btn-full"
                    onClick={cancelActiveOrderLocally}
                  >
                    이력 확인 완료
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-tertiary)', marginBottom: '16px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="empty-title">진행 중인 주문이 없습니다</div>
              <button 
                className="btn-primary" 
                style={{ marginTop: '24px', padding: '12px 24px', flex: 'none' }} 
                onClick={() => setCurrentView('menu')}
              >
                음료 주문하러 가기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. ITEM SELECTION BOTTOM SHEET */}
      {selectedItem && (
        <div className="bottom-sheet-overlay" onClick={closeBottomSheet}>
          <div className="bottom-sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle"></div>
            <div className="bottom-sheet-header">
              <div className="bottom-sheet-title">{selectedItem.name}</div>
              <button className="bottom-sheet-close-btn" onClick={closeBottomSheet}>×</button>
            </div>

            <div className="item-detail-preview">
              <div className="menu-card-image-container" style={{ width: '90px', height: '90px' }}>
                {selectedItem.image ? (
                  <img 
                    src={getApiUrl(selectedItem.image)} 
                    alt={selectedItem.name} 
                    className="menu-card-image"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`menu-card-image-fallback ${getCategoryGradientClass(selectedItem.category)}`}
                  style={{ display: selectedItem.image ? 'none' : 'flex' }}
                >
                  {getCategoryEmoji(selectedItem.category)}
                </div>
              </div>
              <div className="item-detail-info">
                <p className="item-detail-desc">{selectedItem.description || '상세 설명이 등록되지 않았습니다.'}</p>
              </div>
            </div>

            {selectedItem.options && selectedItem.options.length > 0 ? (
              selectedItem.options.map(opt => (
                <div key={opt.id} className="options-group">
                  <div className="options-title">{opt.name}</div>
                  
                  {opt.type === 'select' ? (
                    <div className="options-list" style={{ flexWrap: 'wrap', gap: '8px' }}>
                      {opt.choices.map(choice => (
                        <button
                          key={choice}
                          type="button"
                          className={`option-pill ${customOptions[opt.name] === choice ? 'active' : ''}`}
                          style={{ flex: 'none', minWidth: '80px', padding: '10px 16px' }}
                          onClick={() => setCustomOptions(prev => ({ ...prev, [opt.name]: choice }))}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  ) : (
                    // Counter Option
                    <div className="quantity-controls" style={{ justifyContent: 'start', backgroundColor: 'var(--bg-secondary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)' }}>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => setCustomOptions(prev => ({
                          ...prev,
                          [opt.name]: Math.max(opt.min || 0, (prev[opt.name] || 0) - 1)
                        }))}
                      >
                        -
                      </button>
                      <span className="qty-number" style={{ minWidth: '32px' }}>
                        {customOptions[opt.name] || 0}
                      </span>
                      <button
                        type="button"
                        className="qty-btn"
                        onClick={() => setCustomOptions(prev => ({
                          ...prev,
                          [opt.name]: Math.min(opt.max || 4, (prev[opt.name] || 0) + 1)
                        }))}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <>
                {/* Fallback Temperature Option */}
                <div className="options-group">
                  <div className="options-title">온도</div>
                  <div className="options-list">
                    <button 
                      className={`option-pill ${tempOption === 'Ice' ? 'active' : ''}`}
                      onClick={() => setTempOption('Ice')}
                    >
                      아이스 (Ice)
                    </button>
                    <button 
                      className={`option-pill ${tempOption === 'Hot' ? 'active' : ''}`}
                      onClick={() => setTempOption('Hot')}
                    >
                      핫 (Hot)
                    </button>
                  </div>
                </div>

                {/* Fallback Sweetness Option */}
                <div className="options-group">
                  <div className="options-title">당도 선택</div>
                  <div className="options-list">
                    {['기본', '덜 달게', '시럽 추가'].map(opt => (
                      <button 
                        key={opt}
                        className={`option-pill ${sweetOption === opt ? 'active' : ''}`}
                        onClick={() => setSweetOption(opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Quantity Selector */}
            <div className="quantity-selector">
              <span className="quantity-label">수량</span>
              <div className="quantity-controls">
                <button className="qty-btn" onClick={() => setQuantity(q => Math.max(1, q - 1))}>-</button>
                <span className="qty-number">{quantity}</span>
                <button className="qty-btn" onClick={() => setQuantity(q => q + 1)}>+</button>
              </div>
            </div>

            {/* Actions */}
            <div className="bottom-sheet-actions">
              <button className="btn-secondary" onClick={() => handleAddToCart(false)}>
                장바구니 담기
              </button>
              <button className="btn-primary" onClick={() => handleAddToCart(true)}>
                바로 주문
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. TOAST NOTIFICATION ALERT */}
      {showToast && (
        <div className="toast-alert">
          <span>{toastMessage}</span>
          <button 
            className="toast-link"
            onClick={() => {
              setCurrentView('cart');
              setShowToast(false);
            }}
          >
            장바구니 보기
          </button>
        </div>
      )}

      {/* 7. NICKNAME PROMPT MODAL */}
      {showNicknameModal && (
        <div className="nickname-modal-overlay">
          <div className="nickname-modal-card">
            <div className="nickname-modal-title">닉네임으로 불러드릴까요?</div>
            <div className="nickname-modal-desc">
              음료가 완성되었을 때 등록한 닉네임으로 안내해 드립니다.
            </div>
            <input
              type="text"
              className="nickname-input"
              placeholder="호출받을 이름을 입력하세요"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              maxLength={10}
            />
            <div className="nickname-modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleSkipNickname}
                style={{ padding: '12px 0' }}
              >
                건너뛰기
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => handleSetNickname(nicknameInput)}
                style={{ padding: '12px 0' }}
              >
                설정하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
