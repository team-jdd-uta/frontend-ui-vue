<script setup>
import { computed, ref, watch, onMounted } from 'vue'

const props = defineProps({
  userId: String,
  categories: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'stream-created', 'edit-profile'])

const userInfo = ref({
  userId: '',
  username: '',
  email: '',
  followers: 0,
  following: 0,
  streams: 0
})

const myStreams = ref([])
const followingList = ref([])
const watchHistory = ref([])
const chatList = ref([])
const lastBroadcastProvisioning = ref(null)
const createBroadcastForm = ref({
  name: '',
  category: ''
})
const editBroadcastForm = ref({
  name: '',
  category: ''
})
const activeTab = ref('streams')
const isCreatingBroadcast = ref(false)
const isUpdatingBroadcast = ref(false)
const isBroadcastComposerOpen = ref(false)

const backendBaseUrl = 'https://api.team9.cloud.skala-ai.com'
const userServiceBaseUrl = (import.meta.env.VITE_USER_INFO_SERVER_URL || `${backendBaseUrl}/api/user`).replace(/\/$/, '')
const roomServiceBaseUrl = (import.meta.env.VITE_ROOM_SERVICE_URL || `${backendBaseUrl}/api/room`).replace(/\/$/, '')
const defaultRtmpUrl = 'rtmp://rtmp.team9.cloud.skala-ai.com/live'
const userId = localStorage.getItem('userId')
const getApiToken = () => localStorage.getItem('token') || localStorage.getItem('idToken') || ''
const fallbackCategories = ['게임', '토크', '음악', '스포츠', '요리', '예술', '크리에이티브', '학습']

const availableCategories = computed(() => {
  const source = Array.isArray(props.categories) ? props.categories : []
  const normalized = source
    .map(category => typeof category === 'string' ? category.trim() : '')
    .filter(Boolean)
    .filter(category => category !== '전체')

  const base = normalized.length > 0 ? normalized : fallbackCategories
  return Array.from(new Set(base))
})

const ensureCategorySelection = (form) => {
  const categories = availableCategories.value
  if (!categories.length) {
    form.category = ''
    return
  }
  if (!form.category || !categories.includes(form.category)) {
    form.category = categories[0]
  }
}

watch(
  availableCategories,
  () => {
    ensureCategorySelection(createBroadcastForm.value)
    if (lastBroadcastProvisioning.value) {
      ensureCategorySelection(editBroadcastForm.value)
    }
  },
  { immediate: true }
)

const copyText = async (value) => {
  if (!value) {
    return false
  }

  try {
    await navigator.clipboard.writeText(String(value))
    return true
  } catch (error) {
    console.warn('클립보드 복사 실패:', error)
    return false
  }
}

const getChattingList = async () => {
  if (!userId) {
    console.warn('userId가 없습니다.')
    chatList.value = []
    return
  }

  try {
    const response = await fetch(`${userServiceBaseUrl}/comments/user/${userId}`)
    if (!response.ok) {
      console.error('작성한 댓글 목록 조회 실패:', response.status)
      chatList.value = []
      return
    }

    const data = await response.json()
    const list = Array.isArray(data) ? data : []
    chatList.value = list
      .filter(item => item && (item.comment || item.roomId))
      .map(item => ({
        id: item.id,
        userId: item.userId,
        comment: item.comment,
        roomId: item.roomId,
        createdAt: item.createdAt
      }))
  } catch (error) {
    console.error('작성한 댓글 목록 조회 오류:', error)
    chatList.value = []
  }
}

const getMyStreams = async () => {
  if (!userId) {
    myStreams.value = []
    return
  }

  try {
    const response = await fetch(`${roomServiceBaseUrl}/rooms`)
    if (!response.ok) {
      console.error('내 방송 목록 조회 실패:', response.status)
      myStreams.value = []
      return
    }

    const data = await response.json()
    const list = Array.isArray(data) ? data : []
    myStreams.value = list
      .filter(item => item && String(item.broadcasterId || '').trim() === String(userId).trim())
      .map(item => ({
        id: item.roomId,
        roomId: item.roomId,
        title: item.name || item.roomId,
        category: item.category || '',
        status: item.status || 'UNKNOWN',
        streamKey: item.streamKey || item.roomId,
        viewers: 0,
        date: item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : ''
      }))
  } catch (error) {
    console.error('내 방송 목록 조회 오류:', error)
    myStreams.value = []
  }
}

const openBroadcastManagement = async (stream) => {
  if (!stream?.roomId) {
    return
  }

  const roomDetails = await fetchRoomDetails(stream.roomId)
  const resolvedRoom = roomDetails || stream
  const resolvedCategory = resolvedRoom?.category || stream.category || availableCategories.value[0] || ''
  const resolvedName = resolvedRoom?.name || stream.title || stream.roomId

  lastBroadcastProvisioning.value = {
    roomId: resolvedRoom?.roomId || stream.roomId,
    name: resolvedName,
    category: resolvedCategory,
    status: resolvedRoom?.status || stream.status || 'UNKNOWN',
    streamKey: resolvedRoom?.streamKey || stream.streamKey || stream.roomId,
    joinToken: resolvedRoom?.joinToken || null,
    rtmpUrl: defaultRtmpUrl,
    createdAt: resolvedRoom?.createdAt || null,
    updatedAt: resolvedRoom?.updatedAt || null,
    startedAt: resolvedRoom?.startedAt || null,
    endedAt: resolvedRoom?.endedAt || null
  }
  editBroadcastForm.value = {
    name: lastBroadcastProvisioning.value.name || '',
    category: lastBroadcastProvisioning.value.category || availableCategories.value[0] || ''
  }
}

const fetchRoomDetails = async (roomId) => {
  if (!roomId) {
    return null
  }

  try {
    const response = await fetch(`${roomServiceBaseUrl}/rooms/${encodeURIComponent(roomId)}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('방 상세 조회 실패:', error)
    return null
  }
}

const saveBroadcastMetadata = async () => {
  if (!lastBroadcastProvisioning.value?.roomId) {
    return
  }

  const roomId = lastBroadcastProvisioning.value.roomId
  const trimmedTitle = editBroadcastForm.value.name?.trim()
  const trimmedCategory = editBroadcastForm.value.category?.trim()

  if (!trimmedTitle || !trimmedCategory) {
    alert('방송 제목과 카테고리를 모두 선택해주세요.')
    return
  }

  try {
    isUpdatingBroadcast.value = true
    const apiToken = getApiToken()
    const response = await fetch(`${roomServiceBaseUrl}/rooms/${encodeURIComponent(roomId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': String(userId || '').trim(),
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
      },
      body: JSON.stringify({ name: trimmedTitle, category: trimmedCategory })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const updatedRoom = await response.json()
    await getMyStreams()
    emit('stream-created', updatedRoom)

    if (lastBroadcastProvisioning.value?.roomId === roomId) {
      lastBroadcastProvisioning.value = {
        ...lastBroadcastProvisioning.value,
        roomId: updatedRoom.roomId || roomId,
        name: updatedRoom.name || trimmedTitle,
        category: updatedRoom.category || trimmedCategory,
        status: updatedRoom.status || lastBroadcastProvisioning.value.status,
        streamKey: updatedRoom.streamKey || lastBroadcastProvisioning.value.streamKey || roomId,
        joinToken: updatedRoom.joinToken || lastBroadcastProvisioning.value.joinToken,
        rtmpUrl: lastBroadcastProvisioning.value?.rtmpUrl || defaultRtmpUrl
      }
      editBroadcastForm.value = {
        name: lastBroadcastProvisioning.value.name || trimmedTitle,
        category: lastBroadcastProvisioning.value.category || trimmedCategory
      }
    }
  } catch (error) {
    console.error('방송 정보 수정 실패:', error)
    alert('방송 정보를 수정하는 데 실패했습니다.')
  } finally {
    isUpdatingBroadcast.value = false
  }
}

const getfollowingList = async () => {
  const PAGE = 0
  const SIZE = 20
  try {
    const response = await fetch(`${userServiceBaseUrl}/users/${userId}/Ifollowing/${PAGE}/${SIZE}`)
    if (!response.ok) {
      console.error('팔로잉 목록 조회 실패:', response.status)
      followingList.value = []
      return
    }

    console.log(response)
    const data = await response.json()
    const list = Array.isArray(data) ? data : []
    followingList.value = list
      .filter(item => item && (item.customerID || item.customerName))
      .map(item => ({
        id: item.customerID ?? item.customerName,
        name: item.customerName ?? String(item.customerID),
        isLive: false
      }))
  } catch (error) {
    console.error('팔로잉 목록 조회 오류:', error)
    followingList.value = []
  }
  console.log(followingList)
}

const loadUserData = async () => {
  const userId = props.userId || localStorage.getItem('userId')

  if (!userId) {
    console.warn('userId가 없습니다.')
    return
  }

  try {
    // 사용자 정보 로드
    const response = await fetch(`${userServiceBaseUrl}/users/info/${userId}`)
    if (response.ok) {
      const data = await response.json()
      userInfo.value = {
        userId: userId,
        username: data.username || userId,
        email: data.email || localStorage.getItem('email') || '',
        followers: data.followers || 0,
        following: data.following || 0,
        streams: data.streams || 0
      }
    }
  } catch (error) {
    console.error('사용자 정보 로드 오류:', error)
    // 기본값 설정
    userInfo.value.userId = userId
    userInfo.value.username = userId
    userInfo.value.email = localStorage.getItem('email') || ''
  }

  watchHistory.value = [
    { id: 1, title: '시청 기록 1', date: '2026-02-09' },
    { id: 2, title: '시청 기록 2', date: '2026-02-08' }
  ]

  await getMyStreams()
}

const handleClose = () => {
  emit('close')
}

const unfollowUser = async (user) => {
  if (!userId || !user.id) return
  try {
    const response = await fetch(`${userServiceBaseUrl}/users/${userId}/follow/${encodeURIComponent(user.id)}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      console.error('팔로우 해제 실패:', response.status)
      return
    }
    followingList.value = followingList.value.filter(u => u.id !== user.id)
    userInfo.value.following = Math.max(0, userInfo.value.following - 1)
  } catch (error) {
    console.error('팔로우 해제 오류:', error)
  }
}

const createBroadcast = async () => {
  if (isCreatingBroadcast.value) {
    return
  }

  const trimmedName = createBroadcastForm.value.name?.trim()
  const trimmedCategory = createBroadcastForm.value.category?.trim()

  if (!trimmedName || !trimmedCategory) {
    alert('방송 제목과 카테고리를 모두 선택해주세요.')
    return
  }

  isCreatingBroadcast.value = true

  try {
    const payload = {
      name: trimmedName,
      category: trimmedCategory,
      userId: userId
    }
    const apiToken = getApiToken()

    const response = await fetch(`${roomServiceBaseUrl}/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
      },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const createdRoom = await response.json()
    lastBroadcastProvisioning.value = createdRoom
    editBroadcastForm.value = {
      name: createdRoom.name || trimmedName,
      category: createdRoom.category || trimmedCategory
    }
    isBroadcastComposerOpen.value = false
    await getMyStreams()
    userInfo.value.streams = myStreams.value.length
    emit('stream-created', createdRoom)
    alert('방송이 생성되었습니다.')
  } catch (error) {
    if (String(error?.message || '').includes('HTTP 409')) {
      await getMyStreams()
      const existing = myStreams.value[0]
      if (existing) {
        alert('이미 생성된 방송이 있습니다. 기존 방송을 확인하세요.')
        const roomDetails = await fetchRoomDetails(existing.roomId)
        lastBroadcastProvisioning.value = roomDetails || {
          roomId: existing.roomId,
          name: existing.title,
          category: existing.category || availableCategories.value[0] || '',
          status: existing.status,
          streamKey: existing.streamKey || existing.roomId,
          joinToken: null,
          rtmpUrl: defaultRtmpUrl
        }
        editBroadcastForm.value = {
          name: lastBroadcastProvisioning.value.name || existing.title,
          category: lastBroadcastProvisioning.value.category || existing.category || availableCategories.value[0] || ''
        }
        isBroadcastComposerOpen.value = false
        return
      }
    }
    console.error('방송 생성 실패:', error)
    alert('방송 생성에 실패했습니다.')
  } finally {
    isCreatingBroadcast.value = false
  }
}

const toggleBroadcastComposer = () => {
  isBroadcastComposerOpen.value = !isBroadcastComposerOpen.value
  if (isBroadcastComposerOpen.value) {
    ensureCategorySelection(createBroadcastForm.value)
  }
}

const cancelBroadcastComposer = () => {
  isBroadcastComposerOpen.value = false
}

const deleteBroadcast = async (stream) => {
  if (!stream?.roomId) {
    return
  }

  const confirmed = window.confirm(`방송 "${stream.title}"을(를) 삭제할까요?`)
  if (!confirmed) {
    return
  }

  try {
    const response = await fetch(`${roomServiceBaseUrl}/rooms/${encodeURIComponent(stream.roomId)}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    myStreams.value = myStreams.value.filter(item => item.roomId !== stream.roomId)
    userInfo.value.streams = myStreams.value.length
    if (lastBroadcastProvisioning.value?.roomId === stream.roomId) {
      lastBroadcastProvisioning.value = null
    }
  } catch (error) {
    console.error('방송 삭제 실패:', error)
    alert('방송 삭제에 실패했습니다.')
  }
}

onMounted(() => {
  loadUserData()
  getfollowingList()
  getChattingList()
})
</script>

<template>
  <div class="mypage-container">
    <!-- 상단 네비게이션 -->
    <div class="mypage-header">
      <button class="back-btn" @click="handleClose">
        <span class="back-icon">←</span>
        뒤로가기
      </button>
      <h1 class="page-title">마이페이지</h1>
    </div>

    <!-- 프로필 섹션 -->
    <div class="profile-section">
      <div class="profile-card">
        <div class="profile-avatar">
          {{ userInfo.username.charAt(0).toUpperCase() }}
        </div>
        <div class="profile-info">
          <h2 class="profile-name">{{ userInfo.username }}</h2>
          <p class="profile-email">{{ userInfo.email || userInfo.userId }}</p>
        </div>
        <button class="edit-profile-btn" @click="emit('edit-profile')">프로필 수정</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ userInfo.followers }}</div>
          <div class="stat-label">팔로워</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ userInfo.following }}</div>
          <div class="stat-label">팔로잉</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ userInfo.streams }}</div>
          <div class="stat-label">방송 횟수</div>
        </div>
      </div>
    </div>

    <!-- 탭 섹션 -->
    <div class="tabs-section">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'streams' }" @click="activeTab = 'streams'">내 방송</button>
        <button class="tab" :class="{ active: activeTab === 'following' }" @click="activeTab = 'following'">팔로잉</button>
        <button class="tab" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">시청 기록</button>
        <button class="tab" :class="{ active: activeTab === 'chatting' }" @click="activeTab = 'chatting'">작성한 댓글</button>
      </div>

      <div class="tab-content">
        <!-- 내 방송 목록 -->
        <div v-if="activeTab === 'streams'" class="streams-list">
          <div class="stream-actions">
            <button class="broadcast-btn" @click="toggleBroadcastComposer">
              {{ isBroadcastComposerOpen ? '생성창 닫기' : '방송하기' }}
            </button>
          </div>

          <div v-if="isBroadcastComposerOpen" class="broadcast-composer">
            <div class="composer-header">
              <div>
                <div class="composer-kicker">새 방송 생성</div>
                <h3 class="composer-title">방송 제목과 카테고리 선택</h3>
              </div>
              <button class="composer-close-btn" @click="cancelBroadcastComposer">닫기</button>
            </div>

            <div class="composer-grid">
              <div class="composer-field">
                <label class="composer-label" for="broadcast-name">방송 제목</label>
                <input
                  id="broadcast-name"
                  v-model="createBroadcastForm.name"
                  class="composer-input"
                  type="text"
                  placeholder="방송 제목을 입력하세요"
                />
              </div>

              <div class="composer-field">
                <label class="composer-label" for="broadcast-category">카테고리</label>
                <select
                  id="broadcast-category"
                  v-model="createBroadcastForm.category"
                  class="composer-select"
                >
                  <option v-for="category in availableCategories" :key="category" :value="category">
                    {{ category }}
                  </option>
                </select>
              </div>
            </div>

            <div class="composer-actions">
              <button
                class="composer-submit-btn"
                @click="createBroadcast"
                :disabled="isCreatingBroadcast"
              >
                {{ isCreatingBroadcast ? '생성 중...' : '방송 생성' }}
              </button>
            </div>
          </div>

          <div v-if="lastBroadcastProvisioning" class="obs-panel">
            <div class="obs-panel-header">
              <div>
                <div class="obs-panel-kicker">OBS 연결 정보</div>
                <h3 class="obs-panel-title">{{ lastBroadcastProvisioning.name }}</h3>
              </div>
              <span class="obs-panel-status">{{ lastBroadcastProvisioning.status }}</span>
            </div>
            <div class="obs-grid">
              <div class="obs-field">
                <span class="obs-label">RTMP URL</span>
                <div class="obs-value-row">
                  <code class="obs-value">{{ lastBroadcastProvisioning.rtmpUrl }}</code>
                  <button class="obs-copy-btn" @click="copyText(lastBroadcastProvisioning.rtmpUrl)">복사</button>
                </div>
              </div>
              <div class="obs-field">
                <span class="obs-label">Stream Key</span>
                <div class="obs-value-row">
                  <code class="obs-value">{{ lastBroadcastProvisioning.streamKey }}</code>
                  <button class="obs-copy-btn" @click="copyText(lastBroadcastProvisioning.streamKey)">복사</button>
                </div>
              </div>
              <div class="obs-field">
                <span class="obs-label">Join Token</span>
                <div class="obs-value-row">
                  <code class="obs-value">{{ lastBroadcastProvisioning.joinToken }}</code>
                  <button class="obs-copy-btn" @click="copyText(lastBroadcastProvisioning.joinToken)">복사</button>
                </div>
              </div>
              <div class="obs-field">
                <span class="obs-label">Room ID</span>
                <div class="obs-value-row">
                  <code class="obs-value">{{ lastBroadcastProvisioning.roomId }}</code>
                  <button class="obs-copy-btn" @click="copyText(lastBroadcastProvisioning.roomId)">복사</button>
                </div>
              </div>
              <div class="obs-field">
                <span class="obs-label">카테고리</span>
                <div class="obs-value-row">
                  <code class="obs-value">{{ lastBroadcastProvisioning.category || '미분류' }}</code>
                </div>
              </div>
            </div>
            <p class="obs-help">
              OBS에서 RTMP URL과 Stream Key를 넣고 송출을 시작하면, RTMP 콜백이 방 상태를 LIVE로 바꿉니다.
              현재 stream key는 room id와 동일하게 발급됩니다.
            </p>

            <div class="management-editor">
              <div class="management-header">
                <div>
                  <div class="management-kicker">방송 관리</div>
                  <h3 class="management-title">제목과 카테고리를 수정합니다</h3>
                </div>
              </div>

              <div class="composer-grid">
                <div class="composer-field">
                  <label class="composer-label" for="manage-title">방송 제목</label>
                  <input
                    id="manage-title"
                    v-model="editBroadcastForm.name"
                    class="composer-input"
                    type="text"
                    placeholder="방송 제목을 입력하세요"
                  />
                </div>

                <div class="composer-field">
                  <label class="composer-label" for="manage-category">카테고리</label>
                  <select
                    id="manage-category"
                    v-model="editBroadcastForm.category"
                    class="composer-select"
                  >
                    <option v-for="category in availableCategories" :key="category" :value="category">
                      {{ category }}
                    </option>
                  </select>
                </div>
              </div>

              <div class="composer-actions">
                <button
                  class="composer-submit-btn"
                  @click="saveBroadcastMetadata"
                  :disabled="isUpdatingBroadcast"
                >
                  {{ isUpdatingBroadcast ? '저장 중...' : '방송 정보 저장' }}
                </button>
              </div>
            </div>
          </div>

          <div v-if="myStreams.length === 0" class="empty-state">
            <p>아직 방송 기록이 없습니다.</p>
          </div>
          <div v-else class="stream-item" v-for="stream in myStreams" :key="stream.id">
            <div class="stream-thumbnail">
              <div class="thumbnail-placeholder">🎥</div>
            </div>
            <div class="stream-details">
              <h3 class="stream-title">{{ stream.title }}</h3>
              <div class="stream-meta">
                <span class="meta-item">👁 {{ stream.viewers }}명 시청</span>
                <span class="meta-item">📅 {{ stream.date }}</span>
                <span class="meta-item">🔑 {{ stream.streamKey || stream.roomId }}</span>
                <span class="meta-item">🏷 {{ stream.category || '미분류' }}</span>
              </div>
            </div>
            <button class="action-btn" @click="openBroadcastManagement(stream)">관리</button>
            <button class="delete-btn" @click="deleteBroadcast(stream)">삭제</button>
          </div>
        </div>

        <!-- 팔로잉 목록 -->
        <div v-else-if="activeTab === 'following'" class="following-list">
          <div v-if="followingList.length === 0" class="empty-state">
            <p>팔로잉 중인 스트리머가 없습니다.</p>
          </div>
          <div v-else class="following-item" v-for="user in followingList" :key="user.id">
            <div class="following-avatar">{{ user.name.charAt(0) }}</div>
            <div class="following-info">
              <div class="following-name">{{ user.name }}</div>
              <div class="following-status" :class="{ live: user.isLive }">
                {{ user.isLive ? '🔴 LIVE' : '오프라인' }}
              </div>
            </div>
            <button class="unfollow-btn" @click="unfollowUser(user)">팔로우 해제</button>
          </div>
        </div>

        <!-- 시청 기록 -->
        <div v-else-if="activeTab === 'history'" class="history-list">
          <div v-if="watchHistory.length === 0" class="empty-state">
            <p>시청 기록이 없습니다.</p>
          </div>
          <div v-else class="history-item" v-for="item in watchHistory" :key="item.id">
            <div class="history-icon">🕒</div>
            <div class="history-info">
              <div class="history-title">{{ item.title }}</div>
              <div class="history-date">{{ item.date }}</div>
            </div>
          </div>
        </div>

        <!-- 작성한 댓글 -->
        <div v-else class="chat-list">
          <div v-if="chatList.length === 0" class="empty-state">
            <p>작성한 댓글이 없습니다.</p>
          </div>
          <div v-else class="chat-item" v-for="item in chatList" :key="item.id">
            <div class="chat-item-header">
              <span class="chat-room">방송 ID: {{ item.roomId }}</span>
              <span class="chat-date">{{ item.createdAt }}</span>
            </div>
            <div class="chat-comment">{{ item.comment }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mypage-container {
  min-height: 100vh;
  background-color: #0e0e10;
  color: #efeff1;
}

.mypage-header {
  display: flex;
  align-items: center;
  padding: 20px 30px;
  border-bottom: 1px solid #2a2a2e;
  background-color: #18181b;
  gap: 20px;
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

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
}

.profile-section {
  padding: 30px;
  max-width: 1200px;
  margin: 0 auto;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 20px;
  background-color: #18181b;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 30px;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #0e0e10;
}

.profile-info {
  flex: 1;
}

.profile-name {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.profile-email {
  font-size: 14px;
  color: #b8b8bf;
  margin: 0;
}

.edit-profile-btn {
  background: none;
  border: 1px solid #53535f;
  color: #efeff1;
  padding: 10px 24px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.edit-profile-btn:hover {
  background-color: #2a2a2e;
  border-color: #00ffa3;
  color: #00ffa3;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-card {
  background-color: #18181b;
  padding: 24px;
  border-radius: 12px;
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #00ffa3;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #b8b8bf;
}

.tabs-section {
  max-width: 1200px;
  margin: 30px auto;
  padding: 0 30px;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 30px;
  border-bottom: 1px solid #2a2a2e;
}

.tab {
  background: none;
  border: none;
  color: #b8b8bf;
  padding: 12px 24px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  color: #efeff1;
}

.tab.active {
  color: #00ffa3;
  border-bottom-color: #00ffa3;
}

.streams-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.stream-actions {
  display: flex;
  justify-content: flex-end;
}

.obs-panel {
  background: linear-gradient(180deg, rgba(0, 255, 163, 0.08) 0%, rgba(0, 217, 255, 0.08) 100%);
  border: 1px solid rgba(0, 255, 163, 0.25);
  border-radius: 14px;
  padding: 18px;
  display: grid;
  gap: 16px;
}

.obs-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.obs-panel-kicker {
  font-size: 12px;
  color: #00ffa3;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.obs-panel-title {
  margin: 0;
  font-size: 18px;
  color: #efeff1;
}

.obs-panel-status {
  background-color: rgba(0, 255, 163, 0.16);
  color: #00ffa3;
  border: 1px solid rgba(0, 255, 163, 0.35);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
}

.obs-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.obs-field {
  display: grid;
  gap: 6px;
}

.obs-label {
  font-size: 12px;
  color: #b8b8bf;
  font-weight: 600;
}

.obs-value-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.obs-value {
  flex: 1;
  min-width: 0;
  background-color: #0e0e10;
  border: 1px solid #2a2a2e;
  border-radius: 8px;
  padding: 10px 12px;
  color: #efeff1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.obs-copy-btn {
  border: 1px solid #00ffa3;
  background: rgba(0, 255, 163, 0.08);
  color: #00ffa3;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.obs-help {
  margin: 0;
  color: #b8b8bf;
  font-size: 13px;
  line-height: 1.5;
}

.broadcast-btn {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.broadcast-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.broadcast-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.broadcast-composer,
.management-editor {
  background-color: #18181b;
  border: 1px solid #2a2a2e;
  border-radius: 14px;
  padding: 20px;
  display: grid;
  gap: 16px;
}

.composer-header,
.management-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.composer-kicker,
.management-kicker {
  font-size: 12px;
  color: #00ffa3;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.composer-title,
.management-title {
  margin: 0;
  font-size: 18px;
  color: #efeff1;
}

.composer-close-btn {
  border: 1px solid #53535f;
  background: transparent;
  color: #efeff1;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.composer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.composer-field {
  display: grid;
  gap: 8px;
}

.composer-label {
  font-size: 13px;
  color: #b8b8bf;
  font-weight: 600;
}

.composer-input,
.composer-select {
  width: 100%;
  background-color: #0e0e10;
  border: 1px solid #2a2a2e;
  border-radius: 10px;
  padding: 12px 14px;
  color: #efeff1;
  font-size: 14px;
}

.composer-select:focus,
.composer-input:focus {
  outline: none;
  border-color: #00ffa3;
  box-shadow: 0 0 0 1px rgba(0, 255, 163, 0.18);
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
}

.composer-submit-btn {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  border-radius: 8px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s;
}

.composer-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.composer-submit-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6e6e7a;
}

.stream-item {
  display: flex;
  align-items: center;
  gap: 20px;
  background-color: #18181b;
  padding: 20px;
  border-radius: 12px;
  transition: all 0.2s;
}

.stream-item:hover {
  background-color: #2a2a2e;
}

.stream-thumbnail {
  width: 120px;
  height: 68px;
  background-color: #2a2a2e;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
}

.stream-details {
  flex: 1;
}

.stream-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.stream-meta {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  font-size: 13px;
  color: #b8b8bf;
}

.action-btn {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  transform: scale(1.05);
}

.delete-btn {
  background: none;
  border: 1px solid #f70045;
  color: #f70045;
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: 8px;
}

.delete-btn:hover {
  background-color: rgba(247, 0, 69, 0.1);
  transform: scale(1.03);
}

.following-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.following-item {
  display: flex;
  align-items: center;
  gap: 15px;
  background-color: #18181b;
  padding: 15px 20px;
  border-radius: 12px;
}

.following-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
}

.following-info {
  flex: 1;
}

.following-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.following-status {
  font-size: 12px;
  color: #6e6e7a;
}

.following-status.live {
  color: #f70045;
  font-weight: 600;
}

.unfollow-btn {
  background: none;
  border: 1px solid #53535f;
  color: #efeff1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.unfollow-btn:hover {
  border-color: #f70045;
  color: #f70045;
  background-color: rgba(247, 0, 69, 0.1);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background-color: #18181b;
  padding: 14px 18px;
  border-radius: 12px;
}

.history-icon {
  font-size: 20px;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-title {
  font-size: 14px;
  font-weight: 600;
}

.history-date {
  font-size: 12px;
  color: #b8b8bf;
}

.chat-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-item {
  background-color: #18181b;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #2a2a2e;
}

.chat-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
  color: #b8b8bf;
}

.chat-room {
  font-weight: 600;
  color: #00ffa3;
}

.chat-date {
  font-size: 11px;
}

.chat-comment {
  font-size: 14px;
  color: #efeff1;
  line-height: 1.5;
  word-break: break-word;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .profile-card {
    flex-direction: column;
    text-align: center;
  }

  .stream-item {
    flex-direction: column;
  }

  .stream-thumbnail {
    width: 100%;
  }
}
</style>
