<script setup>
import { ref, onMounted } from 'vue'
import { apiBaseUrl } from '@/config/runtime'

const props = defineProps({
  userId: String
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
const activeTab = ref('streams')
const isCreatingBroadcast = ref(false)

const userId = localStorage.getItem('userId')

const getChattingList = async () => {
  if (!userId) {
    console.warn('userId가 없습니다.')
    chatList.value = []
    return
  }

  try {
    const response = await fetch(`${apiBaseUrl}/comments/user/${userId}`)
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

const getfollowingList = async () => {
  const PAGE = 0
  const SIZE = 20
  try {
    const response = await fetch(`${apiBaseUrl}/users/${userId}/Ifollowing/${PAGE}/${SIZE}`)
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
    const response = await fetch(`${apiBaseUrl}/users/info/${userId}`)
    if (response.ok) {
      const data = await response.json()
      userInfo.value = {
        userId: userId,
        username: data.username || userId,
        email: data.email || '',
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
  }

  // 더미 데이터
  myStreams.value = [
    { id: 1, title: '내 방송 1', viewers: 100, date: '2026-02-10' },
    { id: 2, title: '내 방송 2', viewers: 250, date: '2026-02-11' }
  ]

  watchHistory.value = [
    { id: 1, title: '시청 기록 1', date: '2026-02-09' },
    { id: 2, title: '시청 기록 2', date: '2026-02-08' }
  ]
}

const handleClose = () => {
  emit('close')
}

const createBroadcast = async () => {
  const roomName = window.prompt('생성할 방송(채팅방) 이름을 입력하세요.')
  const trimmedName = roomName?.trim()

  if (!trimmedName) {
    return
  }

  if (isCreatingBroadcast.value) {
    return
  }

  isCreatingBroadcast.value = true

  try {
    const payload = {
      name: trimmedName,
      userId: userId
    }

    const response = await fetch(`${apiBaseUrl}/chat/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const createdRoom = await response.json()
    myStreams.value.unshift({
      id: createdRoom?.roomId || Date.now(),
      title: `${createdRoom?.name || trimmedName} 라이브`,
      viewers: 0,
      date: new Date().toISOString().slice(0, 10)
    })

    userInfo.value.streams += 1
    emit('stream-created', createdRoom)
    alert('방송이 생성되었습니다.')
  } catch (error) {
    console.error('방송 생성 실패:', error)
    alert('방송 생성에 실패했습니다.')
  } finally {
    isCreatingBroadcast.value = false
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
            <button class="broadcast-btn" @click="createBroadcast" :disabled="isCreatingBroadcast">
              {{ isCreatingBroadcast ? '생성 중...' : '방송하기' }}
            </button>
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
              </div>
            </div>
            <button class="action-btn">상세보기</button>
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
            <button class="unfollow-btn">팔로우 해제</button>
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
