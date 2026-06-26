import React, { useState, useEffect } from 'react';
import { useSocket } from './context/SocketContext';
import GuestView from './components/GuestView';
import AdminView from './components/AdminView';
import './App.css';

function MainApp() {
  const [viewMode, setViewMode] = useState('guest'); // guest, admin
  const { completedOrderAlert, setCompletedOrderAlert } = useSocket();

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Send browser notification when order is completed
  useEffect(() => {
    if (completedOrderAlert && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const itemNames = completedOrderAlert.items.map(i => `${i.name} ${i.quantity}잔`).join(', ');
        new Notification('☕ 홈카페 음료 제조 완료!', {
          body: `주문번호 #${completedOrderAlert.orderNumber}번 음료가 나왔습니다: ${itemNames}`,
          icon: '/favicon.ico'
        });
      } catch (e) {
        console.warn('System notification failed to trigger:', e);
      }
    }
  }, [completedOrderAlert]);

  return (
    <>
      {viewMode === 'admin' ? (
        <AdminView onExit={() => setViewMode('guest')} />
      ) : (
        <GuestView onAdminEnter={() => setViewMode('admin')} />
      )}

      {/* Global Completed Order Pickup Overlay */}
      {completedOrderAlert && (
        <div className="pickup-overlay" onClick={() => setCompletedOrderAlert(null)}>
          <div className="pickup-card" onClick={(e) => e.stopPropagation()}>
            <div className="pickup-icon">🎉</div>
            <div className="pickup-title">음료 준비 완료!</div>
            <div className="pickup-body">
              <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--toss-blue)', margin: '8px 0 16px 0' }}>
                주문번호 #{completedOrderAlert.orderNumber}
              </p>
              <p style={{ fontWeight: '500', marginBottom: '8px' }}>주문하신 음료가 맛있게 제조되었습니다.</p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                {completedOrderAlert.items.map(i => `${i.name} ${i.quantity}잔`).join(', ')}
              </p>
            </div>
            <button className="btn-primary btn-full" onClick={() => setCompletedOrderAlert(null)}>
              맛있게 마시기 🥤
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return <MainApp />;
}
