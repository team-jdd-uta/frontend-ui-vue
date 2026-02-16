<script setup>
import { defineProps, defineEmits, ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  id: Number,
  streamer: String,
  streamer_id: String,
  title: String,
  thumbnail: String,
  viewers: Number
})

const emit = defineEmits(['close'])

const messages = ref([])
const chatInput = ref('')
const chatMessagesContainer = ref(null)
const isFollowing = ref(false)
let ws = null

const followingThisUser = async () => {
  const serverUrl = import.meta.env.VITE_APP_SERVER_URL || 'http://localhost:8080'
  const myUserId = localStorage.getItem('userId')
  const streamerId = props.streamer_id

  console.log('팔로우 요청:', { myUserId, streamerId, isFollowing: isFollowing.value })

  if (!serverUrl) {
    console.warn('VITE_APP_SERVER_URL 환경 변수가 설정되지 않았습니다.')
    return
  }

  try {
    if (isFollowing.value) {
      // 언팔로우
      const response = await fetch(`${serverUrl}/users/${myUserId}/unfollow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "user_id": myUserId, "streamerId": streamerId })
      })

      if (response.ok) {
        console.log('언팔로우 성공!')
        isFollowing.value = false
      } else {
        console.error('언팔로우 실패:', response.status)
      }
    } else {
      // 팔로우
      const response = await fetch(`${serverUrl}/users/${myUserId}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ "user_id": myUserId, "streamerId": streamerId })
      })

      if (response.ok) {
        console.log('팔로우 성공!')
        isFollowing.value = true
      } else {
        console.error('팔로우 실패:', response.status)
      }
    }
  } catch (error) {
    console.error('팔로우 요청 오류:', error)
  }
}

const postWatchHistory = () => {
  /*
  * Video를 Stream하는 websocket이 끊어질때 시청 마지막 시청 기록할것..
  * 고도화때 비디오 스트림까지 한다면 고려해야 할 사항...
  */
  const serverUrl = import.meta.env.VITE_APP_SERVER_URL
  const myUserId = localStorage.getItem('userId')
  const streamerId = props.id //방 명을 그냥 id라고 해두었는데, room_id등으로 바꿔야 함..!!

  console.log('시청 로그 기록 요청:', { myUserId, streamerId })

  fetch(`${serverUrl}/watch_history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ "userId": myUserId,
      "videoId": streamerId,
      "startedAt": new Date().toISOString().replace('Z',''),
      "endedAt": new Date().toISOString().replace('Z','') }),
    //replace를 쓴 이유는 서버쪽 포맷과 맞추기 위해. 대신 타임존 정보는 사라짐..
  })
    .then(response => {
      if (response.ok) {
        console.log('시청 로그 기록 성공!')
      } else {
        console.error('시청 로그 기록 실패:', response.status)
      }
    })
    .catch(error => {
      console.error('시청 로그 기록 오류:', error)
    })
}


const handleClose = () => {
  // 웹소켓 연결 닫기
  if (ws) {
    ws.close()
  }
  emit('close')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatMessagesContainer.value) {
      chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight
    }
  })
}

const getMessages = () => {
  const serverUrl = import.meta.env.VITE_APP_SERVER_URL || 'ws://localhost:8080'
  const wsUrl = serverUrl.replace('http://', 'ws://').replace('https://', 'wss://')

  try {
    ws = new WebSocket(`${wsUrl}/chat`)

    ws.onopen = () => {
      console.log('WebSocket 연결 성공')
      // 연결 성공 시 초기 메시지 전송 (선택사항)
      const joinMessage = {
        type: 'join',
        streamer: props.streamer,
        timestamp: new Date().toISOString()
      }
      ws.send(JSON.stringify(joinMessage))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        // 메시지 타입에 따라 처리
        if (data.type === 'chat') {
          messages.value.push({
            id: Date.now() + Math.random(),
            user: data.user || 'Anonymous',
            text: data.message || data.text,
            timestamp: data.timestamp || new Date().toISOString()
          })
          scrollToBottom()
        } else if (data.type === 'history') {
          // 기존 채팅 히스토리 로드
          messages.value = data.messages || []
          scrollToBottom()
        }
      } catch (error) {
        console.error('메시지 파싱 오류:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket 에러:', error)
    }

    ws.onclose = () => {
      console.log('WebSocket 연결 종료')
    }
  } catch (error) {
    console.error('WebSocket 연결 실패:', error)
    // 실패 시 더미 데이터 사용 (개발용)
    loadDummyMessages()
  }
}

const sendMessage = () => {
  if (!chatInput.value.trim()) return

  if (ws && ws.readyState === WebSocket.OPEN) {
    const message = {
      type: 'chat',
      user: 'You',
      message: chatInput.value,
      streamer: props.streamer,
      timestamp: new Date().toISOString()
    }

    ws.send(JSON.stringify(message))

    // 내 메시지를 즉시 화면에 표시
    messages.value.push({
      id: Date.now(),
      user: 'You',
      text: chatInput.value,
      timestamp: new Date().toISOString(),
      isMine: true
    })

    chatInput.value = ''
    scrollToBottom()
  } else {
    console.warn('WebSocket이 연결되지 않았습니다.')
  }
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    sendMessage()
  }
}

// 개발용 더미 메시지 로드
const loadDummyMessages = () => {
  messages.value = [
    { id: 1, user: 'User1', text: '오 신작이네!', timestamp: new Date().toISOString() },
    { id: 2, user: 'User2', text: '대기 중입니다', timestamp: new Date().toISOString() },
    { id: 3, user: 'User3', text: '재밌다!', timestamp: new Date().toISOString() }
  ]
}

const formatViewers = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K'
  }
  return count.toString()
}

onMounted(() => {
  getMessages()
  postWatchHistory()
})

onUnmounted(() => {
  if (ws) {
    ws.close()
  }
})
</script>

<template>
  <div class="video-page">
    <!-- 상단 네비게이션 -->
    <div class="video-top-bar">
      <button class="back-btn" @click="handleClose">
        <span class="back-icon">←</span>
        뒤로가기
      </button>
    </div>

    <!-- 메인 콘텐츠 -->
    <div class="video-main">
      <!-- 좌측: 비디오 플레이어 -->
      <div class="video-player-section">
        <div class="video-player-wrapper">
          <iframe
            width="100%"
            height="100%"
            src="https://www.youtube.com/@codingpe"
            title="Streaming Video"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        </div>

        <!-- 비디오 정보 -->
        <div class="video-info">
          <h1 class="video-title">{{ title }}</h1>
          <div class="video-meta">
            <div class="meta-left">
              <div class="streamer-card">
                <div class="streamer-avatar">{{ streamer.charAt(0) }}</div>
                <div class="streamer-info">
                  <p class="streamer-name">{{ streamer }}</p>
                  <p class="streamer-followers">1.2M 팔로워</p>
                </div>
                <button
                  :class="['follow-btn', { 'following': isFollowing }]"
                  @click="followingThisUser"
                >
                  {{ isFollowing ? '팔로우 끊기' : '팔로우' }}
                </button>
              </div>
            </div>
            <div class="meta-right">
              <div class="stat-item">
                <span class="stat-icon">👁️</span>
                <span class="stat-label">시청자</span>
                <span class="stat-value">{{ formatViewers(viewers) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">❤️</span>
                <span class="stat-label">좋아요</span>
                <span class="stat-value">2.5K</span>
              </div>
              <div class="stat-item">
                <span class="stat-icon">🔗</span>
                <span class="stat-label">공유</span>
              </div>
            </div>
          </div>

          <!-- 설명 -->
          <div class="video-description">
            <p>🎮 실시간 게임 스트리밍 중입니다!</p>
            <p>다양한 게임을 즐기면서 여러분과 소통하겠습니다.</p>
          </div>
        </div>
      </div>

      <!-- 우측: 채팅 및 관련 스트림 -->
      <aside class="video-sidebar">
        <!-- 채팅 섹션 -->
        <div class="chat-section">
          <div class="chat-header">
            <h3>💬 실시간 채팅</h3>
            <span class="chat-count">{{ messages.length }}개의 메시지</span>
          </div>
          <div class="chat-messages" ref="chatMessagesContainer">
            <div
              v-for="message in messages"
              :key="message.id"
              :class="['chat-message', { 'my-message': message.isMine }]"
            >
              <span class="chat-user">{{ message.user }}</span>
              <span class="chat-text">{{ message.text }}</span>
            </div>
            <div v-if="messages.length === 0" class="no-messages">
              <p>아직 채팅이 없습니다.</p>
              <p>첫 메시지를 남겨보세요! 👋</p>
            </div>
          </div>
          <div class="chat-input-area">
            <input
              type="text"
              v-model="chatInput"
              @keypress="handleKeyPress"
              placeholder="채팅을 입력하세요..."
              class="chat-input"
            />
            <button
              class="send-btn"
              @click="sendMessage"
              :disabled="!chatInput.trim()"
            >
              전송
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.video-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #0e0e10;
  color: #efeff1;
}

.video-top-bar {
  display: flex;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #2a2a2e;
  background-color: #18181b;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: none;
  border: none;
  color: #efeff1;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.2s;
}

.back-btn:hover {
  background-color: #2a2a2e;
  color: #00ffa3;
}

.back-icon {
  font-size: 18px;
}

.video-main {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
}

.video-player-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.video-player-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background-color: #0e0e10;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.video-info {
  padding: 20px;
  background-color: #18181b;
  border-radius: 8px;
}

.video-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 20px 0;
  line-height: 1.4;
}

.video-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid #2a2a2e;
  margin-bottom: 20px;
}

.meta-left {
  flex: 1;
}

.streamer-card {
  display: flex;
  align-items: center;
  gap: 12px;
}

.streamer-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  flex-shrink: 0;
}

.streamer-info {
  flex: 1;
}

.streamer-name {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #efeff1;
}

.streamer-followers {
  font-size: 12px;
  color: #b8b8bf;
  margin: 4px 0 0 0;
}

.follow-btn {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.follow-btn:hover {
  transform: scale(1.05);
}

.follow-btn.following {
  background: #2a2a2e;
  color: #efeff1;
  border: 1px solid #53535f;
}

.follow-btn.following:hover {
  background-color: #3a3a3d;
  border-color: #f70045;
  color: #f70045;
}

.meta-right {
  display: flex;
  gap: 20px;
  align-items: center;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 20px;
}

.stat-label {
  font-size: 11px;
  color: #b8b8bf;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #efeff1;
}

.video-description {
  color: #b8b8bf;
  line-height: 1.6;
}

.video-description p {
  margin: 8px 0;
  font-size: 14px;
}

.video-sidebar {
  width: 350px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.chat-section {
  background-color: #18181b;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-header {
  padding: 15px;
  border-bottom: 1px solid #2a2a2e;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  margin: 0;
  font-size: 14px;
}

.chat-count {
  font-size: 11px;
  color: #b8b8bf;
  font-weight: 500;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-message {
  display: flex;
  gap: 8px;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  background-color: rgba(42, 42, 46, 0.3);
  transition: background-color 0.2s;
}

.chat-message:hover {
  background-color: rgba(42, 42, 46, 0.6);
}

.chat-message.my-message {
  background-color: rgba(0, 255, 163, 0.1);
  border-left: 2px solid #00ffa3;
}

.chat-user {
  font-weight: 600;
  color: #00ffa3;
  min-width: 70px;
}

.chat-message.my-message .chat-user {
  color: #00d9ff;
}

.chat-text {
  color: #efeff1;
  word-break: break-word;
  flex: 1;
}

.no-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6e6e7a;
  text-align: center;
  gap: 8px;
}

.no-messages p {
  margin: 0;
  font-size: 13px;
}

.chat-input-area {
  padding: 12px;
  border-top: 1px solid #2a2a2e;
  display: flex;
  gap: 8px;
}

.chat-input {
  flex: 1;
  background-color: #2a2a2e;
  border: none;
  padding: 10px 12px;
  border-radius: 6px;
  color: #efeff1;
  font-size: 13px;
  outline: none;
  transition: background-color 0.2s;
}

.chat-input:focus {
  background-color: #3a3a3d;
}

.chat-input::placeholder {
  color: #6e6e7a;
}

.send-btn {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 255, 163, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #2a2a2e;
  color: #6e6e7a;
}

/* 스크롤바 스타일 */
.chat-messages::-webkit-scrollbar,
.video-main::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track,
.video-main::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb,
.video-main::-webkit-scrollbar-thumb {
  background: #2a2a2e;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover,
.video-main::-webkit-scrollbar-thumb:hover {
  background: #3a3a3d;
}

/* 반응형 */
@media (max-width: 1200px) {
  .video-sidebar {
    width: 300px;
  }

  .stat-item {
    gap: 2px;
  }

  .stat-label {
    font-size: 10px;
  }
}

@media (max-width: 1024px) {
  .video-main {
    flex-direction: column;
    gap: 15px;
  }

  .video-sidebar {
    width: 100%;
    max-height: 300px;
  }

  .chat-messages {
    max-height: 200px;
  }
}

@media (max-width: 768px) {
  .video-main {
    padding: 15px;
    gap: 10px;
  }

  .video-sidebar {
    display: none;
  }

  .video-title {
    font-size: 18px;
  }

  .meta-right {
    flex-wrap: wrap;
    gap: 15px;
  }
}
</style>
