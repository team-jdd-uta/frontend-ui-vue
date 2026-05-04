<script setup>
import Hls from 'hls.js'
import { defineProps, defineEmits, ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { io } from 'socket.io-client'

const props = defineProps({
  id: [String, Number],
  streamer: String,
  streamer_id: String,
  roomId: [String, Number],
  streamKey: [String, Number],
  roomStatus: String,
  title: String,
  thumbnail: String,
  viewers: Number
})

const emit = defineEmits(['close'])

const messages = ref([])
const chatInput = ref('')
const chatMessagesContainer = ref(null)
const chatHistoryContainer = ref(null)
const isFollowing = ref(false)
const defaultPinnedChatMessage = '방송자 전용 AI 채팅 동향 요약을 실행하면 최근 5분 채팅 흐름이 표시됩니다.'
const pinnedChatMessage = ref(defaultPinnedChatMessage)
const chatHistoryVisible = ref(false)
const chatHistoryLoading = ref(false)
const chatHistoryLoadingMore = ref(false)
const chatHistoryHasMore = ref(false)
const chatHistoryItems = ref([])
const chatHistoryCursor = ref(null)
const chatHistoryError = ref('')
const selectedChatTarget = ref(null)
const chatHistoryRequestSeq = ref(0)
const summaryLoading = ref(false)
const summaryError = ref('')
const summaryMeta = ref(null)

const isChatConnected = ref(false)
const chatUsername = ref(localStorage.getItem('username') || localStorage.getItem('userId') || 'guest')
const activeRoomId = () => String(props.roomId ?? '').trim()
const currentUserId = computed(() => String(localStorage.getItem('userId') || '').trim())
const isBroadcaster = computed(() => String(props.streamer_id ?? '').trim() === currentUserId.value)

const reconnectBaseDelayMs = 1000
const reconnectMaxDelayMs = 10000
const reconnectJitterMaxMs = 300
const reconnectMaxDurationMs = 60000
const roomStatusPollIntervalMs = 5000

let socketClient = null
let reconnectTimer = null
let reconnectScheduled = false
let reconnectAttempt = 0
let reconnectStartedAtMs = null
let userInitiatedDisconnect = false
let summaryPollTimer = null
let roomStatusPollTimer = null

const backendBaseUrl = 'https://api.team9.cloud.skala-ai.com'
const userServiceBaseUrl = (import.meta.env.VITE_USER_INFO_SERVER_URL || `${backendBaseUrl}/api/user`).replace(/\/$/, '')
const roomServiceBaseUrl = (import.meta.env.VITE_ROOM_SERVICE_URL || `${backendBaseUrl}/api/room`).replace(/\/$/, '')
const chatHistoryBaseUrl = (import.meta.env.VITE_CHAT_HISTORY_SERVER_URL || `${backendBaseUrl}/api/chat-history`).replace(/\/$/, '')
const socketBaseUrl = (import.meta.env.VITE_SOCKET_BASE_URL || backendBaseUrl).replace(/\/$/, '')
const summaryPollIntervalMs = 5000
const socketPath = (import.meta.env.VITE_SOCKET_PATH || '/api/socket').replace(/\/$/, '')

// HLS player config - use streamKey if present, otherwise roomId
const hlsBaseUrl = (import.meta.env.VITE_HLS_BASE_URL || 'http://localhost:8088').replace(/\/$/, '')
const videoRef = ref(null)
const status = ref('플레이리스트를 불러오는 중입니다...')
const roomSnapshot = ref({
  status: String(props.roomStatus || '').trim().toUpperCase()
})
const normalizedRoomStatus = computed(() => {
  return String(roomSnapshot.value?.status || props.roomStatus || '').trim().toUpperCase()
})
const isRoomEnded = computed(() => normalizedRoomStatus.value === 'ENDED')
const isRoomPreparing = computed(() => normalizedRoomStatus.value === 'READY' || normalizedRoomStatus.value === 'STOPPED')
const roomPreparingMessage = computed(() => {
  if (normalizedRoomStatus.value === 'STOPPED') {
    return '방송이 잠시 중단되었습니다. 진행자가 송출을 재개하면 영상이 다시 연결됩니다.'
  }
  return '방송 준비 중입니다. 진행자가 송출을 시작하면 영상이 연결됩니다.'
})

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
  const streamKey = String(props.streamKey ?? props.roomId ?? '').trim()
  if (!streamKey) return ''
  return `${hlsBaseUrl}/hls/${encodeURIComponent(streamKey)}/index.m3u8`
}

async function fetchRoomSnapshot() {
  const roomId = activeRoomId()
  if (!roomId) {
    return
  }

  try {
    const response = await fetch(`${roomServiceBaseUrl}/rooms/${encodeURIComponent(roomId)}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    roomSnapshot.value = {
      ...(data || {}),
      status: String(data?.status || '').trim().toUpperCase()
    }
  } catch (error) {
    console.warn('방 상태 조회 실패:', error)
  }
}

function stopRoomStatusPolling() {
  if (roomStatusPollTimer) {
    window.clearInterval(roomStatusPollTimer)
    roomStatusPollTimer = null
  }
}

function startRoomStatusPolling() {
  stopRoomStatusPolling()
  roomStatusPollTimer = window.setInterval(fetchRoomSnapshot, roomStatusPollIntervalMs)
}

function loadStream() {
  const video = videoRef.value
  if (!video) return

  destroyPlayer()

  if (isRoomEnded.value) {
    status.value = '방송이 종료되었습니다.'
    return
  }

  if (isRoomPreparing.value) {
    status.value = roomPreparingMessage.value
    return
  }

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

function syncRoomPlaybackState() {
  if (isRoomEnded.value) {
    destroyPlayer()
    status.value = '방송이 종료되었습니다.'
    if (isChatConnected.value) {
      disconnectChat()
    }
    return
  }

  if (isRoomPreparing.value) {
    destroyPlayer()
    status.value = roomPreparingMessage.value
    return
  }

  loadStream()
}

watch(normalizedRoomStatus, () => {
  syncRoomPlaybackState()
})

watch(() => props.roomId, async () => {
  // reload stream when room changes
  closeChatHistoryPanel()
  roomSnapshot.value = {
    status: String(props.roomStatus || '').trim().toUpperCase()
  }
  pinnedChatMessage.value = defaultPinnedChatMessage
  startSummaryPolling()
  await fetchRoomSnapshot()
  startRoomStatusPolling()
  syncRoomPlaybackState()
})

watch(isBroadcaster, () => {
  pinnedChatMessage.value = defaultPinnedChatMessage
  summaryError.value = ''
  summaryMeta.value = null
  startSummaryPolling()
})

const followingThisUser = async () => {
  const myUserId = localStorage.getItem('userId')
  const streamerId = props.streamer_id

  if (!myUserId || isFollowing.value) {
    return
  }

  try {
    const response = await fetch(`${userServiceBaseUrl}/users/${myUserId}/follow`, {
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

const formatChatHistoryTime = (value) => {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const resetChatHistoryState = () => {
  chatHistoryVisible.value = false
  chatHistoryLoading.value = false
  chatHistoryLoadingMore.value = false
  chatHistoryHasMore.value = false
  chatHistoryItems.value = []
  chatHistoryCursor.value = null
  chatHistoryError.value = ''
}

const scrollChatHistoryToBottom = () => {
  nextTick(() => {
    if (chatHistoryContainer.value) {
      chatHistoryContainer.value.scrollTop = chatHistoryContainer.value.scrollHeight
    }
  })
}

const loadChatHistoryPage = async ({ prepend = false, cursor = null } = {}) => {
  if (!isBroadcaster.value) {
    return
  }

  const ownerUserId = String(props.streamer_id ?? '').trim()
  const targetUserId = String(selectedChatTarget.value?.userId || '').trim()
  if (!ownerUserId || !targetUserId) {
    return
  }

  const requestSeq = ++chatHistoryRequestSeq.value
  const pageSize = 50
  const loadingRef = prepend ? chatHistoryLoadingMore : chatHistoryLoading
  loadingRef.value = true
  chatHistoryError.value = ''

  const container = chatHistoryContainer.value
  const previousScrollHeight = container?.scrollHeight || 0
  const previousScrollTop = container?.scrollTop || 0

  try {
    const params = new URLSearchParams()
    params.set('limit', String(pageSize))
    if (cursor) {
      params.set('before', cursor)
    }

    const response = await fetch(
      `${chatHistoryBaseUrl}/owners/${encodeURIComponent(ownerUserId)}/users/${encodeURIComponent(targetUserId)}?${params.toString()}`
    )

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    if (requestSeq !== chatHistoryRequestSeq.value) {
      return
    }

    const items = Array.isArray(data?.items) ? data.items : []
    const normalized = items.map((item) => ({
      id: `${item.id}-${item.sourceStreamId || item.createdAt || Math.random()}`,
      roomId: item.roomId || '',
      roomName: item.roomName || '',
      senderUserId: item.senderUserId || item.targetUserId || '',
      senderDisplayName: item.senderDisplayName || item.senderUserId || item.targetUserId || '',
      message: item.message || '',
      createdAt: item.createdAt || '',
    }))

    if (prepend) {
      chatHistoryItems.value = [...normalized, ...chatHistoryItems.value]
    } else {
      chatHistoryItems.value = normalized
    }

    chatHistoryHasMore.value = Boolean(data?.hasMore)
    chatHistoryCursor.value = data?.nextCursor || null
    chatHistoryVisible.value = true

    await nextTick()

    if (prepend && container) {
      const nextScrollHeight = container.scrollHeight || 0
      container.scrollTop = nextScrollHeight - previousScrollHeight + previousScrollTop
    } else {
      scrollChatHistoryToBottom()
    }
  } catch (error) {
    console.error('채팅 기록 조회 오류:', error)
    if (requestSeq === chatHistoryRequestSeq.value) {
      chatHistoryError.value = '채팅 기록을 불러오지 못했습니다.'
    }
  } finally {
    if (requestSeq === chatHistoryRequestSeq.value) {
      loadingRef.value = false
    }
  }
}

const openChatHistoryPanel = (message) => {
  if (!isBroadcaster.value || !message || message.isSystem) {
    return
  }

  const senderUserId = String(message.senderUserId || message.userId || message.user || '').trim()
  if (!senderUserId) {
    return
  }

  const senderDisplayName = String(message.senderDisplayName || message.user || senderUserId).trim()
  if (
    selectedChatTarget.value &&
    selectedChatTarget.value.userId === senderUserId &&
    selectedChatTarget.value.displayName === senderDisplayName
  ) {
    return
  }

  chatHistoryRequestSeq.value += 1
  selectedChatTarget.value = {
    userId: senderUserId,
    displayName: senderDisplayName || senderUserId
  }
  chatHistoryItems.value = []
  chatHistoryCursor.value = null
  chatHistoryHasMore.value = false
  chatHistoryError.value = ''
  chatHistoryVisible.value = false
}

const handleChatHistoryScroll = async () => {
  if (!chatHistoryVisible.value || !chatHistoryHasMore.value || chatHistoryLoadingMore.value) {
    return
  }

  const container = chatHistoryContainer.value
  if (!container || container.scrollTop > 24 || !chatHistoryCursor.value) {
    return
  }

  await loadChatHistoryPage({
    prepend: true,
    cursor: chatHistoryCursor.value
  })
}

const showChatHistory = () => {
  if (!selectedChatTarget.value) {
    return
  }
  if (!chatHistoryVisible.value) {
    chatHistoryVisible.value = true
  }
  if (chatHistoryItems.value.length === 0 && !chatHistoryLoading.value) {
    loadChatHistoryPage({ prepend: false })
  }
}

const closeChatHistoryPanel = () => {
  chatHistoryRequestSeq.value += 1
  selectedChatTarget.value = null
  chatHistoryVisible.value = false
  chatHistoryItems.value = []
  chatHistoryCursor.value = null
  chatHistoryHasMore.value = false
  chatHistoryError.value = ''
  chatHistoryLoading.value = false
  chatHistoryLoadingMore.value = false
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

const getViewerUserId = () => {
  return String(localStorage.getItem('userId') || chatUsername.value || '').trim()
}

const buildRoomServiceHeaders = () => {
  const headers = {
    'X-User-Id': getViewerUserId(),
  }

  const token = String(localStorage.getItem('token') || '').trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

const getSocketAuthToken = () => {
  return String(localStorage.getItem('idToken') || localStorage.getItem('token') || '').trim()
}

const fetchJoinToken = async (roomId, userId) => {
  const response = await fetch(
    `${roomServiceBaseUrl}/rooms/${encodeURIComponent(roomId)}/join-token?userId=${encodeURIComponent(userId)}`,
    {
      method: 'POST',
      headers: buildRoomServiceHeaders(),
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await response.json()
    const token = String(data?.joinToken ?? data?.token ?? data?.value ?? '').trim()
    if (token) {
      return token
    }
  } else {
    const text = String(await response.text()).trim()
    if (text) {
      try {
        const parsed = JSON.parse(text)
        const token = String(parsed?.joinToken ?? parsed?.token ?? parsed?.value ?? '').trim()
        if (token) {
          return token
        }
      } catch (error) {
        return text
      }
    }
  }

  throw new Error('join token is empty')
}

const fetchLatestSummary = async () => {
  const roomId = activeRoomId()
  if (!roomId || !isBroadcaster.value) {
    return
  }

  try {
    const response = await fetch(`${chatHistoryBaseUrl}/summaries/${encodeURIComponent(roomId)}`)
    if (response.status === 404) {
      return
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    const summary = String(data.summary || '').trim()
    if (summary) {
      pinnedChatMessage.value = summary
    }
  } catch (error) {
    console.warn('AI 반응 분석 조회 실패:', error)
  }
}

const requestManualSummary = async () => {
  if (!isBroadcaster.value || summaryLoading.value) {
    return
  }

  const roomId = activeRoomId()
  const requesterUserId = currentUserId.value
  if (!roomId || !requesterUserId) {
    summaryError.value = '방송자 정보를 확인할 수 없습니다.'
    return
  }

  summaryLoading.value = true
  summaryError.value = ''
  try {
    const response = await fetch(`${chatHistoryBaseUrl}/rooms/${encodeURIComponent(roomId)}/summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': requesterUserId
      },
      body: JSON.stringify({ requesterUserId })
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (data?.error === 'INSUFFICIENT_CHAT_MESSAGES') {
        summaryError.value = data.message || '최근 5분 내 요약할 채팅이 부족합니다.'
        summaryMeta.value = {
          messageCount: data.messageCount ?? 0,
          minMessages: data.minMessages ?? 10,
          windowMinutes: data.windowMinutes ?? 5
        }
        return
      }
      throw new Error(data?.message || `HTTP ${response.status}`)
    }

    const summary = String(data.summary || '').trim()
    if (!summary) {
      throw new Error('요약 결과가 비어 있습니다.')
    }

    pinnedChatMessage.value = summary
    summaryMeta.value = {
      messageCount: data.sourceMessageCount ?? data.messageCount ?? 0,
      minMessages: data.minMessages ?? 10,
      windowMinutes: data.windowMinutes ?? 5
    }
  } catch (error) {
    console.error('AI 채팅 동향 요약 요청 실패:', error)
    summaryError.value = 'AI 채팅 동향 요약을 생성하지 못했습니다.'
  } finally {
    summaryLoading.value = false
  }
}

const stopSummaryPolling = () => {
  if (summaryPollTimer) {
    window.clearInterval(summaryPollTimer)
    summaryPollTimer = null
  }
}

const startSummaryPolling = () => {
  stopSummaryPolling()
  if (!isBroadcaster.value) {
    pinnedChatMessage.value = defaultPinnedChatMessage
    return
  }
  fetchLatestSummary()
  summaryPollTimer = window.setInterval(fetchLatestSummary, summaryPollIntervalMs)
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
  const isSuperChat = payload.isSuperChat === true ||
    payload.isSuperChat === 'true' ||
    payload.superChat === true ||
    payload.superChat === 'true'
  if (isSuperChat) {
    console.log('슈퍼챗 수신:', payload)
  }

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
    senderUserId: payload.senderUserId || payload.userId || '',
    senderDisplayName: sender || payload.senderDisplayName || '',
    text,
    isMine: !isSystem && String(payload.senderUserId || payload.userId || '') === getViewerUserId(),
    isSystem,
    isSuperChat
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
  if (isRoomEnded.value) {
    isChatConnected.value = false
    return
  }

  if (!chatUsername.value.trim()) {
    console.error('사용자 이름이 없습니다. localStorage username/userId를 확인하세요.')
    return
  }

  const roomId = activeRoomId()
  if (!roomId) {
    console.error('roomId가 없습니다. 스트림 선택 데이터(roomId/id)를 확인하세요.')
    return
  }

  const viewerUserId = getViewerUserId()
  if (!viewerUserId) {
    console.error('사용자 ID가 없습니다. localStorage userId를 확인하세요.')
    return
  }

  let joinToken = ''
  try {
    joinToken = await fetchJoinToken(roomId, viewerUserId)
  } catch (error) {
    console.error('join token 발급 실패:', error)
    isChatConnected.value = false
    if (!userInitiatedDisconnect) {
      scheduleReconnect('join token error')
    }
    return
  }

  userInitiatedDisconnect = false

  if (!isReconnect) {
    messages.value = []
  }

  const client = io(socketBaseUrl, {
    path: socketPath,
    autoConnect: false,
    reconnection: false,
    transports: ['websocket', 'polling'],
    auth: getSocketAuthToken()
      ? { token: getSocketAuthToken() }
      : {}
  })

  client.on('connect', () => {
    socketClient = client
    resetReconnectState()

    client.emit('ENTER', {
      roomId,
      sender: chatUsername.value,
      userId: viewerUserId,
      joinToken,
    })
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
    if (error?.code === 'TALK_FAILED') {
      alert('채팅 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
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
  const superChat = isSuperChat === true

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
    userId: getViewerUserId(),
    message: messageContent,
    isSuperChat: superChat
  })
  console.log('채팅 전송:', { roomId: activeRoomId(), isSuperChat: superChat })

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

onMounted(async () => {
  postWatchHistory()
  startSummaryPolling()
  await fetchRoomSnapshot()
  startRoomStatusPolling()
  connectChat(false)
  // start video player for the current room
  syncRoomPlaybackState()
})

onUnmounted(() => {
  stopSummaryPolling()
  stopRoomStatusPolling()
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
        <div class="video-player-wrapper" :class="{ preparing: isRoomPreparing, ended: isRoomEnded }">
          <video
            v-show="!isRoomPreparing && !isRoomEnded"
            ref="videoRef"
            controls
            playsinline
            muted
            style="width:100%; height:100%;"
          ></video>
          <div v-if="isRoomPreparing || isRoomEnded" class="video-state-overlay">
            <div class="video-state-badge">
              {{ isRoomEnded ? '방송 종료' : '방송 준비중' }}
            </div>
            <h2 class="video-state-title">
              {{ isRoomEnded ? '방송이 종료되었습니다.' : '방송 준비 중입니다.' }}
            </h2>
            <p class="video-state-description">
              {{ isRoomEnded
                ? '방송이 완전히 종료되어 다시 입장할 수 없습니다.'
                : roomPreparingMessage }}
            </p>
          </div>
        </div>
        <div class="player-status" v-if="status && !isRoomPreparing && !isRoomEnded">{{ status }}</div>

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

          <div v-if="isBroadcaster" class="chat-pinned-message">
            {{ pinnedChatMessage }}
          </div>
          <div v-if="isBroadcaster" class="chat-summary-controls">
            <button
              class="chat-summary-btn"
              @click="requestManualSummary"
              :disabled="summaryLoading"
            >
              {{ summaryLoading ? '요약 생성 중...' : '최근 5분 채팅 동향 요약' }}
            </button>
            <p v-if="summaryMeta" class="chat-summary-meta">
              최근 {{ summaryMeta.windowMinutes }}분 / {{ summaryMeta.messageCount }}개 메시지 기준
            </p>
            <p v-if="summaryError" class="chat-summary-error">{{ summaryError }}</p>
          </div>
          <div v-if="selectedChatTarget" class="chat-history-panel">
            <div class="chat-history-panel-header">
              <div>
                <div class="chat-history-panel-kicker">방송 주인 전용</div>
                <h4 class="chat-history-panel-title">{{ selectedChatTarget.displayName }}</h4>
                <p class="chat-history-panel-meta">{{ selectedChatTarget.userId }}</p>
              </div>
              <button class="chat-history-close-btn" @click="closeChatHistoryPanel">
                닫기
              </button>
            </div>

            <div v-if="!chatHistoryVisible" class="chat-history-intro">
              <p>이 사용자가 내 방송들에서 남긴 채팅을 확인할 수 있습니다.</p>
              <button class="chat-history-open-btn" @click="showChatHistory">채팅 보기</button>
            </div>

            <div v-else class="chat-history-list" ref="chatHistoryContainer" @scroll="handleChatHistoryScroll">
              <div v-if="chatHistoryLoading && chatHistoryItems.length === 0" class="chat-history-empty">
                <p>채팅 기록을 불러오는 중입니다...</p>
              </div>
              <div v-else-if="chatHistoryItems.length === 0" class="chat-history-empty">
                <p>이 사용자의 채팅 기록이 없습니다.</p>
              </div>
              <template v-else>
                <div v-if="chatHistoryLoadingMore" class="chat-history-loading-more">이전 채팅을 불러오는 중...</div>
                <div
                  v-for="item in chatHistoryItems"
                  :key="item.id"
                  class="chat-history-item"
                >
                  <div class="chat-history-item-meta">
                    <span class="chat-history-room">{{ item.roomName || item.roomId }}</span>
                    <span class="chat-history-time">{{ formatChatHistoryTime(item.createdAt) }}</span>
                  </div>
                  <div class="chat-history-message">{{ item.message }}</div>
                </div>
              </template>
            </div>

            <p v-if="chatHistoryError" class="chat-history-error">{{ chatHistoryError }}</p>
            <p v-if="chatHistoryVisible && chatHistoryHasMore" class="chat-history-hint">위로 스크롤하면 더 이전 채팅을 불러옵니다.</p>
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
              <button
                v-if="!message.isSystem"
                class="chat-user chat-user-button"
                @click="openChatHistoryPanel(message)"
                :disabled="!isBroadcaster"
                :title="isBroadcaster ? '닉네임을 눌러 채팅 기록을 확인합니다.' : '방송자만 채팅 기록을 볼 수 있습니다.'"
              >
                {{ message.senderDisplayName || message.user }}
              </button>
              <span v-else class="chat-user">{{ message.isSystem ? '시스템' : message.user }}</span>
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
              @click="sendMessage()"
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

.video-state-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  background:
    radial-gradient(circle at top, rgba(124, 58, 237, 0.18), transparent 42%),
    linear-gradient(180deg, rgba(10, 10, 14, 0.92), rgba(16, 16, 24, 0.98));
  color: #f4f4f5;
}

.video-state-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: #d4d4d8;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.video-state-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.25;
}

.video-state-description {
  max-width: 420px;
  margin-top: 12px;
  color: #a1a1aa;
  font-size: 15px;
  line-height: 1.6;
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

.chat-pinned-message {
  padding: 12px 15px;
  border-bottom: 1px solid rgba(0, 255, 163, 0.2);
  background-color: rgba(0, 255, 163, 0.08);
  color: #efeff1;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  word-break: keep-all;
  white-space: pre-line;
}

.chat-summary-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px;
}

.chat-summary-btn {
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 10px 12px;
  background: #00ffa3;
  color: #08110d;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.15s ease;
}

.chat-summary-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: #46ffc0;
}

.chat-summary-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.chat-summary-meta {
  margin: 0;
  color: #adadb8;
  font-size: 12px;
}

.chat-summary-error {
  margin: 0;
  color: #ff8a8a;
  font-size: 12px;
  line-height: 1.4;
}

.chat-history-panel {
  margin: 12px 12px 0;
  padding: 14px;
  border: 1px solid rgba(0, 255, 163, 0.18);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(0, 255, 163, 0.08), rgba(0, 217, 255, 0.05));
  display: grid;
  gap: 12px;
}

.chat-history-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.chat-history-panel-kicker {
  font-size: 11px;
  font-weight: 700;
  color: #00ffa3;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

.chat-history-panel-title {
  margin: 0;
  font-size: 15px;
  color: #efeff1;
}

.chat-history-panel-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #b8b8bf;
  word-break: break-all;
}

.chat-history-close-btn,
.chat-history-open-btn {
  border: 1px solid rgba(0, 255, 163, 0.25);
  background: rgba(0, 255, 163, 0.12);
  color: #00ffa3;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chat-history-close-btn:hover,
.chat-history-open-btn:hover {
  transform: translateY(-1px);
  background: rgba(0, 255, 163, 0.2);
}

.chat-history-intro {
  display: grid;
  gap: 10px;
  color: #c6c6cc;
  font-size: 13px;
}

.chat-history-list {
  max-height: 260px;
  overflow-y: auto;
  padding-right: 4px;
  display: grid;
  gap: 10px;
}

.chat-history-empty,
.chat-history-loading-more {
  padding: 14px;
  border-radius: 10px;
  background-color: rgba(42, 42, 46, 0.35);
  color: #b8b8bf;
  font-size: 13px;
  text-align: center;
}

.chat-history-item {
  border-radius: 10px;
  padding: 12px;
  background-color: rgba(42, 42, 46, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: grid;
  gap: 8px;
}

.chat-history-item-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #b8b8bf;
}

.chat-history-room {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-history-time {
  white-space: nowrap;
  flex-shrink: 0;
}

.chat-history-message {
  font-size: 13px;
  line-height: 1.5;
  color: #efeff1;
  word-break: break-word;
}

.chat-history-error {
  margin: 0;
  color: #ff7b7b;
  font-size: 12px;
}

.chat-history-hint {
  margin: 0;
  color: #8dd2f0;
  font-size: 12px;
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

.chat-user-button {
  background: none;
  border: none;
  text-align: left;
  padding: 0;
  cursor: pointer;
}

.chat-user-button:disabled {
  cursor: not-allowed;
  opacity: 0.9;
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
