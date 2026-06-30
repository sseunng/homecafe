#!/bin/bash

# 에러 발생 시 스크립트 중단
set -e

# 스크립트 파일이 있는 위치로 이동 (어디서나 실행 가능하도록 설정)
cd "$(dirname "$0")"

echo "============================================="
echo "   [1/4] 소스코드 다운로드 (Git Pull)"
echo "============================================="
git pull

echo "============================================="
echo "   [2/4] 로컬 종속성 설치 (Npm Install)"
echo "============================================="
npm install

echo "============================================="
echo "   [3/4] 프론트엔드 빌드 (Npm Run Build)"
echo "============================================="
npm run build

echo "============================================="
echo "   [4/4] PM2 서비스 재시작 (PM2 Reload)"
echo "============================================="
if command -v pm2 &> /dev/null; then
  # pm2 list에서 homecafe-kiosk가 존재하는지 검사
  if pm2 show homecafe-kiosk &> /dev/null; then
    echo "PM2에서 homecafe-kiosk 서비스를 찾았습니다. 재시작(Reload)을 수행합니다."
    pm2 reload homecafe-kiosk || pm2 restart homecafe-kiosk || true
  else
    echo "PM2에 등록된 homecafe-kiosk 서비스가 없습니다. 신규 기동(Start)을 수행합니다."
    pm2 start server/server.js --name "homecafe-kiosk" || true
  fi
else
  echo "PM2 명령어를 찾을 수 없습니다. 수동으로 서비스를 재시작해 주세요."
fi

echo "============================================="
echo " 🎉 PM2 로컬 업데이트가 완료되었습니다!"
echo "============================================="
