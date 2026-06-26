# 개발 완료 가이드 - 홈 카페 키오스크 (Home Cafe Kiosk)

홈 카페 키오스크 웹 애플리케이션의 구현 및 검증을 성공적으로 마쳤습니다. 본 애플리케이션은 토스 오더 스타일의 모던하고 깔끔한 프론트엔드와 실시간 Node.js 백엔드로 구성되어 있습니다.

---

## 완료된 작업 사항

### 1. 루트 프로젝트 구성 및 스크립트 오케스트레이션
- 루트 [package.json](file:///Users/choeseunghyeong/Desktop/kiosk/package.json)을 생성하여 개발 모드(`npm run dev`)에서 클라이언트와 서버를 동시에 실행하고, 통합 의존성을 관리할 수 있도록 구성했습니다.
- 백엔드 서버가 빌드된 React 파일을 서빙할 수 있도록 빌드 스크립트(`npm run build`)를 추가했습니다.

### 2. 백엔드 (Express & WebSockets)
- [server.js](file:///Users/choeseunghyeong/Desktop/kiosk/server/server.js): 3000번 포트로 작동하는 단일 Express 서버를 구축했습니다. Socket.io를 설정하여 역할별 룸(`admin` 및 `guest_guestId`)을 실시간으로 관리하고, `multer`를 활용해 메뉴 이미지 업로드 API를 구현했습니다.
- [data_store.js](file:///Users/choeseunghyeong/Desktop/kiosk/server/data_store.js): 매일 아침 1번부터 시작하여 주문 시마다 순차적으로 증가하는 주문 번호 발급 로직을 구현하였으며, 기본 메뉴 5종을 사전에 수록했습니다.

### 3. 프론트엔드 (React + Vite + Toss CSS)
- [index.css](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/index.css) 및 [App.css](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/App.css): 토스 블루, 딥 차콜, 소프트 그레이 등의 HSL 색상 시스템과 시스템 다크 모드 자동 전환, 부드러운 모서리 라운딩(`16px`/`24px`), 버튼 클릭 시 살짝 작아지는 미세 애니메이션(`active: scale(0.96)`)을 구현했습니다.
- [SocketContext.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/context/SocketContext.jsx): 실시간 이벤트를 중재하며, 음료 준비가 완료되면 브라우저 오디오 API(Web Audio API)를 통해 아름다운 차임벨 효과음이 나도록 구현했습니다.
- [GuestView.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/components/GuestView.jsx): 카테고리 필터 탭, 음료 옵션 선택 바텀 시트, 장바구니 추가 토스트 알림, 주문 완료 후 실시간 대기 화면을 구현했습니다.
- [AdminView.jsx](file:///Users/choeseunghyeong/Desktop/kiosk/client/src/components/AdminView.jsx): 비밀번호(PIN) 잠금 화면(기본값: `2026`), 3단계 실시간 주문 보드(대기 중 -> 제조 중 ☕ -> 제조 완료), 메뉴 품절 전환 및 추가/삭제 관리 기능을 구현했습니다.

---

## 로컬 검증 및 테스트 결과

1. **빌드 및 파이프라인 검증**: Vite를 통한 프로덕션 빌드가 에러 없이 완벽히 컴파일되는 것을 확인했습니다.
2. **실시간 로컬 구동**: `npm run dev` 실행 시 클라이언트와 백엔드 서버가 충돌 없이 동시에 시작됩니다.
3. **API 요청 테스트**: cURL 명령을 이용해 주문 생성 및 메뉴 조회가 실시간 소켓 브로드캐스트와 연동되는 것을 확인했습니다.

---

## Proxmox 서버 배포 가이드

Proxmox 서버(`192.168.1.38`)에 24시간 안정적으로 구동하려면 **Docker Compose**(LXC 컨테이너 또는 VM 환경)를 사용하는 것을 추천합니다.

### 1단계: 프로젝트 파일 전송
Mac 터미널에서 프로젝트 폴더를 압축한 뒤 `scp`를 이용해 서버로 전송합니다.
```bash
# Mac 터미널에서 실행
cd /Users/choeseunghyeong/Desktop
tar -czf kiosk.tar.gz kiosk
scp kiosk.tar.gz root@192.168.1.38:/root/
```

### 2단계: Proxmox 서버에서 압축 해제
Proxmox VM/LXC 터미널로 로그인하여 압축을 해제합니다.
```bash
# Proxmox VM/LXC 터미널에서 실행
cd /root
tar -xzf kiosk.tar.gz
cd kiosk
```

### 3단계: Docker Compose로 백그라운드 구동
`docker`와 `docker-compose`가 설치되어 있는지 확인하고 서비스를 실행합니다.
```bash
docker compose up -d --build
```
> [!NOTE]
> 컨테이너 빌드가 진행되면서 React 빌드가 수행되고, 데이터 저장 디렉토리(`server/data`)와 이미지 저장소(`server/public/uploads`)는 영구 볼륨(Volume)으로 바인딩되어 컨테이너가 다시 켜져도 데이터가 안전하게 유지됩니다.

### 4단계: 접속 및 QR 코드 배치
1. 내부 망에서 `http://192.168.1.38:3000`으로 접속하여 서비스 작동을 확인합니다.
2. 게스트 메인 화면 좌측 상단 **"☕ Home Cafe"** 타이틀을 연속 5회 클릭하여 PIN 관리자 화면으로 진입하고 암호 **`2026`**을 입력해 대시보드를 띄웁니다.
3. `http://192.168.1.38:3000` 주소에 대한 QR 코드를 생성해 홈 카페 테이블이나 벽면에 부착하세요.
