<script setup>
import Hls from 'hls.js'
import { defineProps, defineEmits, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { io } from 'socket.io-client'

const props = defineProps({
  id: [String, Number],
  streamer: String,
  streamer_id: String,
  roomId: [String, Number],
  title: String,
  thumbnail: String,
  viewers: Number
})

const emit = defineEmits(['close'])

const messages = ref([])
const chatInput = ref('')
const chatMessagesContainer = ref(null)
const isFollowing = ref(false)

const isChatConnected = ref(false)
const chatUsername = ref(localStorage.getItem('username') || localStorage.getItem('userId') || 'guest')
const activeRoomId = () => String(props.roomId ?? '').trim()

const reconnectBaseDelayMs = 1000
const reconnectMaxDelayMs = 10000
const reconnectJitterMaxMs = 300
const reconnectMaxDurationMs = 60000

let socketClient = null
let reconnectTimer = null
let reconnectScheduled = false
let reconnectAttempt = 0
let reconnectStartedAtMs = null
let userInitiatedDisconnect = false

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const socketBaseUrl = (import.meta.env.VITE_SOCKET_BASE_URL || window.location.origin).replace(/\/$/, '')

// HLS player config - use roomId as stream key
const hlsBaseUrl = (import.meta.env.VITE_HLS_BASE_URL || 'http://localhost:8088').replace(/\/$/, '')
const videoRef = ref(null)
const status = ref('플레이리스트를 불러오는 중입니다...')

let hls = null
let retryTimer = null
let watchdogTimer = null
let lastCurrentTime = 0

function destroyPlayer() {
  if (retryTimer) {
    window.clearTimeout(retryTimer)
    retryTimer = null
  }

  if (hls) {
    hls.off(Hls.Events.MANIFEST_PARSED)
    hls.off(Hls.Events.ERROR)
    hls.off(Hls.Events.BUFFER_EOS)
    hls.off(Hls.Events.FRAG_BUFFERED)
    try { hls.destroy() } catch (e) {}
    hls = null
  }

  if (watchdogTimer) {
    window.clearInterval(watchdogTimer)
    watchdogTimer = null
  }
}

function scheduleReload(message) {
  if (retryTimer) return
  status.value = message
  retryTimer = window.setTimeout(() => {
    retryTimer = null
    loadStream()
  }, 2000)
}

function buildPlaylistUrl() {
  const roomId = String(props.roomId ?? '').trim()
  if (!roomId) return ''
  return `${hlsBaseUrl}/hls/${encodeURIComponent(roomId)}/index.m3u8`
}

function loadStream() {
  const video = videoRef.value
  if (!video) return

  destroyPlayer()

  const playlistUrl = buildPlaylistUrl()
  if (!playlistUrl) {
    status.value = '스트림 키(방 주소)가 없습니다.'
    return
  }

  if (Hls.isSupported()) {
    hls = new Hls({
      lowLatencyMode: true,
      liveSyncDurationCount: 2,
      liveMaxLatencyDurationCount: 4,
      maxBufferLength: 6,
      backBufferLength: 0,
      enableWorker: true
    })

    hls.loadSource(playlistUrl)
    hls.attachMedia(video)

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      status.value = '스트림 연결 성공. 재생을 시작합니다.'
      video.play().catch(() => {
        status.value = '자동 재생이 차단되었습니다. 재생 버튼을 눌러주세요.'
      })
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          scheduleReload(`네트워크 오류. 다시 연결 중 (${data.details})`)
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); hls.startLoad(-1) } catch (e) {}
          scheduleReload(`미디어 오류 복구 중 (${data.details})`)
          return
        }
        try { hls.startLoad(-1) } catch (e) {}
        scheduleReload(`재생 오류. 다시 연결 중 (${data.details})`)
      }
    })

    hls.on(Hls.Events.BUFFER_EOS, () => {
      try { hls.startLoad(-1) } catch (e) {}
      scheduleReload('스트림이 일시 종료되었습니다. 재연결 중입니다.')
    })

    hls.on(Hls.Events.FRAG_BUFFERED, () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer)
        retryTimer = null
        status.value = '스트림 버퍼 갱신 — 재생 유지 중입니다.'
      }
      try { if (video && video.paused) video.play().catch(() => {}) } catch (e) {}
    })

    if (!watchdogTimer) {
      lastCurrentTime = video.currentTime || 0
      watchdogTimer = window.setInterval(() => {
        try {
          const v = videoRef.value
          if (!v) return
          const now = v.currentTime || 0
          if (!v.paused && Math.abs(now - lastCurrentTime) < 0.5) {
            if (hls) { try { hls.startLoad(-1) } catch (e) {} }
            v.play().catch(() => {})
          }
          lastCurrentTime = now
        } catch (e) {}
      }, 3000)
    }

    video.addEventListener('ended', () => {
      scheduleReload('스트림이 끝났습니다. 다시 연결 중입니다.')
    }, { once: true })

    return
  }

  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = buildPlaylistUrl()
    video.addEventListener('loadedmetadata', () => {
      video.play().catch(() => { status.value = '자동 재생 차단됨. 재생 버튼을 눌러주세요.' })
    }, { once: true })
    video.addEventListener('ended', () => {
      scheduleReload('스트림이 끝났습니다. 다시 연결 중입니다.')
    }, { once: true })
    status.value = '네이티브 HLS로 재생 중입니다.'
    return
  }

  status.value = '이 브라우저는 HLS 재생을 지원하지 않습니다.'
}

watch(() => props.roomId, () => {
  // reload stream when room changes
  loadStream()
})

const followingThisUser = async () => {
  const myUserId = localStorage.getItem('userId')
  const streamerId = props.streamer_id

  if (!myUserId || isFollowing.value) {
    return
  }

  try {
    const response = await fetch(`${apiBaseUrl}/users/${myUserId}/follow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: myUserId, streamerId })
    })

    if (response.ok) {
      isFollowing.value = true
    }
  } catch (error) {
    console.error('팔로우 요청 오류:', error)
  }
}

const postWatchHistory = () => {
  // 현재 분리된 user-service에는 watch_history 생성 API가 없다.
  // 조회 API가 추가되면 서버 계약에 맞춰 다시 연결한다.
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatMessagesContainer.value) {
      chatMessagesContainer.value.scrollTop = chatMessagesContainer.value.scrollHeight
    }
  })
}

const resetReconnectState = () => {
  reconnectScheduled = false
  reconnectAttempt = 0
  reconnectStartedAtMs = null
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

const fetchFromApi = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, options)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response
}

const appendSingleChatMessage = (payload) => {
  if (!payload) {
    return
  }

  const isSystem = payload.type === 'ENTER' || payload.type === 'QUIT'
  const rawSender = typeof payload.sender === 'string' ? payload.sender.trim() : ''
  const sender = rawSender || 'SYSTEM'
  const rawText = typeof payload.message === 'string' ? payload.message.trim() : ''
  let text = rawText

  if (isSystem && !text) {
    if (payload.type === 'ENTER') {
      text = `${rawSender || '사용자'}님이 입장하셨습니다.`
    } else if (payload.type === 'QUIT') {
      text = `${rawSender || '사용자'}님이 퇴장하셨습니다.`
    } else {
      text = '시스템 메시지'
    }
  }

  if (!isSystem && !text) {
    return
  }

  messages.value.push({
    id: Date.now() + Math.random(),
    user: sender || 'SYSTEM',
    text,
    isMine: !isSystem && sender === chatUsername.value,
    isSystem,
    isSuperChat: payload.isSuperChat === true
  })
}

const appendChatMessage = (payload) => {
  if (!payload) {
    return
  }

  if (Array.isArray(payload)) {
    payload.forEach((item) => appendSingleChatMessage(item))
    scrollToBottom()
    return
  }

  if (payload.type === 'BATCH') {
    const batchedMessages = Array.isArray(payload.messages) ? payload.messages : []
    if (batchedMessages.length === 0) {
      return
    }
    batchedMessages.forEach((item) => appendSingleChatMessage(item))
    scrollToBottom()
    return
  }

  appendSingleChatMessage(payload)
  scrollToBottom()
}

const returnToDisconnectedState = (reason) => {
  console.warn('채팅 재연결 중단:', reason)
  userInitiatedDisconnect = true
  isChatConnected.value = false
  resetReconnectState()

  if (socketClient) {
    try {
      socketClient.disconnect()
    } catch (error) {
      console.warn('채팅 연결 정리 중 오류:', error)
    }
  }

  socketClient = null
}

const scheduleReconnect = (reason, delayMs) => {
  if (userInitiatedDisconnect || reconnectScheduled) {
    return
  }

  const now = Date.now()
  if (!reconnectStartedAtMs) {
    reconnectStartedAtMs = now
  }

  const elapsed = now - reconnectStartedAtMs
  if (elapsed >= reconnectMaxDurationMs) {
    returnToDisconnectedState('reconnect timeout')
    return
  }

  const backoffDelay = Math.min(reconnectBaseDelayMs * (2 ** reconnectAttempt), reconnectMaxDelayMs)
  let retryDelay = typeof delayMs === 'number' ? delayMs : backoffDelay
  retryDelay += Math.floor(Math.random() * reconnectJitterMaxMs)

  if (elapsed + retryDelay > reconnectMaxDurationMs) {
    retryDelay = reconnectMaxDurationMs - elapsed
  }

  reconnectScheduled = true

  reconnectTimer = setTimeout(() => {
    reconnectScheduled = false
    reconnectAttempt += 1
    connectChat(true)
  }, Math.max(retryDelay, 0))

  console.warn('채팅 재연결 예약:', reason, retryDelay)
}

const connectChat = async (isReconnect = false) => {
  if (!chatUsername.value.trim()) {
    console.error('사용자 이름이 없습니다. localStorage username/userId를 확인하세요.')
    return
  }

  const roomId = activeRoomId()
  if (!roomId) {
    console.error('roomId가 없습니다. 스트림 선택 데이터(roomId/id)를 확인하세요.')
    return
  }

  try {
    await fetchFromApi(`/chat/rooms/${encodeURIComponent(roomId)}`)
  } catch (error) {
    console.warn('채팅방 확인 실패, 소켓 연결은 계속 시도합니다:', error)
  }

  userInitiatedDisconnect = false

  if (!isReconnect) {
    messages.value = []
  }

  const client = io(socketBaseUrl, {
    path: '/socket.io',
    autoConnect: false,
    reconnection: false,
    transports: ['websocket', 'polling']
  })

  client.on('connect', () => {
    socketClient = client
    resetReconnectState()

    client.emit('ENTER', { roomId, sender: chatUsername.value })
  })

  client.on('ENTER_ACK', () => {
    isChatConnected.value = true
    appendChatMessage({
      type: 'ENTER',
      roomId,
      sender: chatUsername.value,
      message: ''
    })
  })

  client.on('TALK', (payload) => {
    appendChatMessage(payload)
  })

  client.on('connect_error', (error) => {
    console.error('Socket.IO connect error:', error?.message || error)
    isChatConnected.value = false
    scheduleReconnect('socket connect error')
  })

  client.on('error', (error) => {
    console.error('Socket.IO error:', error?.message || error)
    isChatConnected.value = false
    scheduleReconnect(error?.code || 'socket error')
  })

  client.on('disconnect', (reason) => {
    isChatConnected.value = false

    if (userInitiatedDisconnect) {
      return
    }

    scheduleReconnect(reason || 'socket disconnected')
  })

  socketClient = client
  client.connect()
}

const disconnectChat = () => {
  userInitiatedDisconnect = true
  resetReconnectState()

  if (socketClient && socketClient.connected) {
    try {
      socketClient.emit('QUIT', {
        roomId: activeRoomId(),
        sender: chatUsername.value
      })
    } catch (error) {
      console.warn('QUIT 전송 실패:', error)
    }
  }

  if (socketClient) {
    socketClient.disconnect()
    socketClient = null
  }

  isChatConnected.value = false
}

const sendMessage = (isSuperChat = false) => {
  const messageContent = chatInput.value.trim()

  if (!messageContent) {
    return
  }

  if (!socketClient || !socketClient.connected) {
    alert('채팅 서버에 연결되어 있지 않습니다.')
    return
  }

  socketClient.emit('TALK', {
    roomId: activeRoomId(),
    sender: chatUsername.value,
    message: messageContent,
    isSuperChat
  })

  chatInput.value = ''
}

const sendSuperChat = () => {
  sendMessage(true)
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    sendMessage()
  }
}

const handleClose = () => {
  disconnectChat()
  emit('close')
}

const formatViewers = (count) => {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

onMounted(() => {
  postWatchHistory()
  connectChat(false)
  // start video player for the current room
  loadStream()
})

onUnmounted(() => {
  disconnectChat()
  // clean up HLS player
  destroyPlayer()
})
</script>

<template>
  <div class="video-page">
    <div class="video-top-bar">
      <button class="back-btn" @click="handleClose">
        <span class="back-icon">←</span>
        뒤로가기
      </button>
    </div>

    <div class="video-main">
      <div class="video-player-section">
        <div class="video-player-wrapper">
          <video ref="videoRef" controls playsinline muted style="width:100%; height:100%;"></video>
        </div>
        <div class="player-status" v-if="status">{{ status }}</div>

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
                  :class="['follow-btn', { following: isFollowing }]"
                  :disabled="isFollowing"
                  :title="isFollowing ? '팔로우 취소는 준비 중입니다' : ''"
                  @click="followingThisUser"
                >
                  {{ isFollowing ? '팔로잉' : '팔로우' }}
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

          <div class="video-description">
            <p>🎮 실시간 게임 스트리밍 중입니다!</p>
            <p>다양한 게임을 즐기면서 여러분과 소통하겠습니다.</p>
          </div>
        </div>
      </div>

      <aside class="video-sidebar">
        <div class="chat-section">
          <div class="chat-header">
            <h3>💬 실시간 채팅</h3>
            <span class="chat-count">{{ messages.length }}개의 메시지</span>
          </div>

          <div class="chat-messages" ref="chatMessagesContainer">
            <div
              v-for="message in messages"
              :key="message.id"
              :class="[
                'chat-message',
                {
                  'my-message': message.isMine,
                  'system-message': message.isSystem,
                  'super-chat': message.isSuperChat
                }
              ]"
            >
              <span class="chat-user">{{ message.isSystem ? '시스템' : message.user }}</span>
              <span class="chat-text">{{ message.text }}</span>
            </div>
            <div v-if="messages.length === 0" class="no-messages">
              <p>아직 채팅이 없습니다.</p>
              <p>메시지를 입력해 대화를 시작하세요.</p>
            </div>
          </div>

          <div class="chat-input-area">
            <input
              type="text"
              v-model="chatInput"
              @keypress="handleKeyPress"
              placeholder="채팅을 입력하세요..."
              class="chat-input"
              :disabled="!isChatConnected"
            />
            <button
              class="superchat-btn"
              @click="sendSuperChat"
              :disabled="!isChatConnected || !chatInput.trim()"
              title="수퍼챗 보내기"
              aria-label="수퍼챗 보내기"
            >
              💵
            </button>
            <button
              class="send-btn"
              @click="sendMessage"
              :disabled="!isChatConnected || !chatInput.trim()"
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

.follow-btn.following:hover,
.follow-btn:disabled:hover {
  background-color: #2a2a2e;
  border-color: #53535f;
  color: #efeff1;
  cursor: not-allowed;
  transform: none;
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
  width: 380px;
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

.chat-message.system-message {
  background-color: rgba(88, 88, 95, 0.35);
}

.chat-message.super-chat {
  background-color: rgba(255, 215, 0, 0.22);
  border: 1px solid rgba(255, 215, 0, 0.7);
  box-shadow: 0 0 0 1px rgba(255, 215, 0, 0.12), 0 8px 24px rgba(255, 215, 0, 0.16);
}

.chat-user {
  font-weight: 600;
  color: #00ffa3;
  min-width: 70px;
}

.chat-message.my-message .chat-user {
  color: #00d9ff;
}

.chat-message.system-message .chat-user {
  color: #9ba0a8;
}

.chat-message.super-chat .chat-user {
  color: #ffd166;
}

.chat-text {
  color: #efeff1;
  word-break: break-word;
  flex: 1;
}

.chat-message.super-chat .chat-text {
  color: #fff7df;
  font-weight: 600;
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

.superchat-btn {
  width: 42px;
  min-width: 42px;
  border: none;
  border-radius: 6px;
  background-color: #ffd54a;
  color: #18181b;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.2s, background-color 0.2s, opacity 0.2s;
}

.superchat-btn:hover:not(:disabled) {
  background-color: #ffcc1f;
  transform: translateY(-1px);
}

.superchat-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.send-btn {
  border: none;
  padding: 10px 14px;
  border-radius: 6px;
  background-color: #00ffa3;
  color: #0e0e10;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s, transform 0.2s;
}

.send-btn:hover:not(:disabled) {
  background-color: #00d9ff;
  transform: translateY(-1px);
}

.send-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

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

@media (max-width: 1200px) {
  .video-sidebar {
    width: 320px;
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
    max-height: 420px;
  }

  .chat-messages {
    max-height: 220px;
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
