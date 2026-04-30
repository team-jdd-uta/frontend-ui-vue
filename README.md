# frontend-ui-vue

Kubernetes 채팅 MSA와 연동하는 Vue 3 프론트엔드입니다. 채팅방 목록, 방 생성, 방송 화면 진입, Socket.IO 기반 채팅 연결을 담당합니다.

## 역할

- `/api/room/rooms`로 room-service 기반 채팅방 목록을 조회합니다.
- `/api/room/rooms?name=...`로 채팅방을 생성합니다.
- `/api/socket`으로 Socket.IO Gateway에 연결합니다.
- `/api/user/users`, `/api/user/comments`로 user-service의 사용자/댓글 API를 호출합니다.

## 기술 스택

- Vue 3
- Vite
- Socket.IO Client
- Nginx runtime image

## 주요 화면 흐름

```text
로그인 또는 회원가입
  -> 메인 화면 채팅방 목록 조회
  -> 마이페이지에서 방 생성
  -> 방송/채팅 화면 진입
  -> Socket.IO ENTER
  -> TALK 송수신
```

## API 경로

| Frontend path | 대상 |
| --- | --- |
| `/api/room/rooms` | room-service `/rooms` |
| `/api/user/users/...` | user-service `/users/...` |
| `/api/user/comments/...` | user-service `/comments/...` |
| `/api/socket` | socket-io-gateway Socket.IO endpoint |

운영/Kubernetes에서는 Vite dev proxy가 아니라 Ingress가 위 경로를 라우팅합니다.

## 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_ROOM_SERVICE_URL` | `/api/room` | room-service base path |
| `VITE_USER_INFO_SERVER_URL` | `/api/user` | user-service base path |
| `VITE_SOCKET_BASE_URL` | `window.location.origin` | Socket.IO base URL |
| `VITE_SOCKET_PATH` | `/api/socket` | Socket.IO path |
| `VITE_PROXY_TARGET` | 없음 | `npm run dev`에서 사용할 backend/ingress target |

개발 서버 실행 시 `VITE_PROXY_TARGET`이 필요합니다.

예:

```env
VITE_ROOM_SERVICE_URL=/api/room
VITE_USER_INFO_SERVER_URL=/api/user
VITE_SOCKET_PATH=/api/socket
VITE_PROXY_TARGET=http://localhost:8088
```

## 로컬 실행

```bash
npm install
npm run dev
```

빌드:

```bash
npm run build
```

Docker 이미지 빌드:

```bash
docker build -t team9-ui-vue:local .
```

## Nginx Runtime

Dockerfile은 Vite build 결과를 Nginx로 서빙합니다.

```text
frontend-ui-vue/Dockerfile
frontend-ui-vue/nginx.conf
```

Nginx는 SPA fallback을 위해 `try_files $uri $uri/ /index.html`을 사용합니다.

## Socket.IO

채팅 화면은 `socket.io-client`를 사용합니다.

연결 설정:

```js
io(socketBaseUrl, {
  path: '/api/socket',
  transports: ['websocket', 'polling']
})
```

사용 이벤트:

- `ENTER`
- `ENTER_ACK`
- `TALK`
- `QUIT`
- `disconnect`
- `connect_error`

## Kubernetes 기준

- Service port는 `80`입니다.
- Ingress host 예: `skala3-cloud1-team9.cloud.skala-ai.com`
- `/api/socket`는 WebSocket upgrade가 가능해야 합니다.
- `/api/user/comments`는 user-service의 `/comments`로 전달되어야 합니다.

## 주의점

- 로그인/회원가입은 Cognito 연동 후 확정되는 흐름입니다. 현재 모달은 서버 URL이 없으면 안내 메시지만 보여줍니다.
- 방 조회 실패가 있어도 채팅 화면에서는 Socket.IO 연결을 계속 시도합니다.
- `watch_history` 생성 API는 현재 분리된 user-service에 맞춰 비활성화되어 있습니다.
