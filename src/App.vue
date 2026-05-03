<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'
import CategorySection from './components/CategorySection.vue'
import StreamsGrid from './components/StreamsGrid.vue'
import RightSidebar from './components/RightSidebar.vue'
import StreamingVideoSection from './components/StreamingVideoSection.vue'
import LoginPage from './components/LoginPage.vue'
import SignUpPage from './components/SignUpPage.vue'
import MyPage from './components/MyPage.vue'
import ProfileEditPage from './components/ProfileEditPage.vue'

const selectedCategory = ref('전체')
const selectedNav = ref('홈')
const searchValue = ref('')
const selectedStream = ref(null)
const isLoginModalOpen = ref(false)
const isSignupModalOpen = ref(false)
const isLoggedIn = ref(false)
const currentUser = ref(null)
const isLoggingOut = ref(false)
const showMyPage = ref(false)
const showProfileEditPage = ref(false)
const defaultCategories = ['게임', '토크', '음악', '스포츠', '요리', '예술', '크리에이티브', '학습']
const categories = ref(['전체', ...defaultCategories])
const backendBaseUrl = 'https://api.team9.cloud.skala-ai.com'
const roomServiceBaseUrl = (import.meta.env.VITE_ROOM_SERVICE_URL || `${backendBaseUrl}/api/room`).replace(/\/$/, '')
const authBaseUrl = (import.meta.env.VITE_LOGIN_SERVER_URL || `${backendBaseUrl}/auth`).replace(/\/$/, '')
const demoModeEnabled = String(import.meta.env.VITE_DEMO_MODE || 'false').toLowerCase() === 'true'
const HOME_PATH = '/'
const MY_PAGE_PATH = '/mypage'

// VITE_DEMO_MODE=true일 때만 사용하는 로컬 데모 데이터
const fallbackStreams = [
  {
    id: 1,
    title: '즐거운 게임 방송 - 리그오브레전드 랭크 도전!',
    streamer: '게이머스트리머',
    streamer_id: "user003",
    category: '게임',
    viewers: 12340,
    thumbnail: '/images/stream-10.jpg',
    isLive: true,
    tags: ['LOL', '랭크게임', '한국서버']
  },
  {
    id: 2,
    title: '편안한 토크쇼 - 여러분과 함께하는 수다 시간',
    streamer: '토크킹',
    streamer_id: "user004",
    category: '토크',
    viewers: 8560,
    thumbnail: '/images/stream-2.jpg',
    isLive: true,
    tags: ['수다', '힐링', 'Q&A']
  },
  {
    id: 3,
    title: '신나는 음악 방송 🎵 신청곡 받아요!',
    streamer: 'DJ뮤직',
    streamer_id: "user005",
    category: '음악',
    viewers: 23410,
    thumbnail: '/images/stream-1.jpg',
    isLive: true,
    tags: ['음악', '신청곡', 'DJ']
  },
  {
    id: 4,
    title: '궁극의 저녁 매뉴!',
    streamer: '미슐랭 킬러',
    streamer_id: "user005",
    category: '요리',
    viewers: 5670000,
    thumbnail: '/images/stream-4.jpg',
    isLive: true,
    tags: ['발로란트', 'FPS', '강의']
  },
  {
    id: 5,
    title: '맛있는 요리 방송 - 오늘은 파스타!',
    streamer: '쿡킹마스터',
    streamer_id: "user006",
    category: '요리',
    viewers: 18900,
    thumbnail: '/images/stream-5.jpg',
    isLive: true,
    tags: ['요리', '파스타', '레시피']
  },
  {
    id: 6,
    title: '⚽ 프리미어리그 하이라이트 분석',
    streamer: '스포츠해설가',
    streamer_id: "user007",
    category: '스포츠',
    viewers: 34560,
    thumbnail: '/images/stream-6.jpg',
    isLive: true,
    tags: ['축구', '해설', '프리미어리그']
  },
  {
    id: 7,
    title: '디지털 아트 작업 과정 공개',
    streamer: '아티스트K',
    streamer_id: "user008",
    category: '크리에이티브',
    viewers: 4320,
    thumbnail: '/images/stream-7.jpg',
    isLive: true,
    tags: ['그림', '디지털아트', '작업과정']
  },
  {
    id: 8,
    title: '파이썬 기초부터 시작하기',
    streamer: '코딩선생님',
    streamer_id: "user009",
    category: '학습',
    viewers: 6780,
    thumbnail: '/images/stream-8.jpg',
    isLive: true,
    tags: ['파이썬', '프로그래밍', '초보환영']
  },
  {
    id: 9,
    title: '오버워치2 시즌 최고 랭크 도전',
    streamer: '오버워치프로',
    streamer_id: "user010",
    category: '게임',
    viewers: 15670,
    thumbnail: '/images/stream-9.jpg',
    isLive: true,
    tags: ['오버워치', '랭크', 'FPS']
  }
]
const liveStreams = ref(demoModeEnabled ? [...fallbackStreams] : [])
const roomThumbnails = [
  '/images/stream-1.jpg',
  '/images/stream-2.jpg',
  '/images/stream-3.jpg',
  '/images/stream-4.jpg',
  '/images/stream-5.jpg',
  '/images/stream-6.jpg',
  '/images/stream-7.jpg',
  '/images/stream-8.jpg',
  '/images/stream-9.jpg',
  '/images/stream-10.jpg'
]
const fallbackRecommendedStreamers = [
  { name: '정찬혁', avatar: '👨‍💼', viewers: 45600, isLive: true },
  { name: '김현문', avatar: '👩‍🎤', viewers: 32100, isLive: true },
  { name: '김유빈', avatar: '👨‍🎨', viewers: 28900, isLive: true },
  { name: '페이커', avatar: '👩‍💻', viewers: 19800, isLive: false },
  { name: '손흥민', avatar: '👨‍🍳', viewers: 12300, isLive: true }
]
const recommendedStreamers = ref(demoModeEnabled ? fallbackRecommendedStreamers : [])

const trendingItems = computed(() => {
  return liveStreams.value.slice(0, 5).map(stream => ({
    title: stream.title,
    category: stream.category,
    viewers: stream.viewers
  }))
})

const filteredStreams = computed(() => {
  let results = selectedCategory.value === '전체'
    ? liveStreams.value
    : liveStreams.value.filter(stream => stream.category === selectedCategory.value)

  if (searchValue.value.trim()) {
    const q = searchValue.value.trim().toLowerCase()
    results = results.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.streamer.toLowerCase().includes(q)
    )
  }
  return results
})

const filterByCategory = (category) => {
  selectedCategory.value = category
}

const selectNav = (nav) => {
  selectedNav.value = nav
  routeToHome()
  pushRoute(HOME_PATH)
}

const getRoomIdFromStream = (stream) => {
  return String(stream?.roomId ?? stream?.id ?? '')
}

const findStreamByRoomId = (roomId) => {
  return liveStreams.value.find((stream) => getRoomIdFromStream(stream) === String(roomId))
}

const setViewState = ({ stream = null, isMyPage = false, isProfileEditPage = false }) => {
  showMyPage.value = isMyPage
  showProfileEditPage.value = isProfileEditPage
  selectedStream.value = isMyPage ? null : stream
}

const pushRoute = (path) => {
  if (window.location.pathname === path) {
    return
  }
  window.history.pushState({}, '', path)
}

const routeToHome = () => {
  setViewState({ stream: null, isMyPage: false, isProfileEditPage: false })
}

const applyRouteFromPath = (path) => {
  if (path === `${MY_PAGE_PATH}/edit`) {
    setViewState({ isProfileEditPage: true })
    return
  }

  if (path === MY_PAGE_PATH) {
    setViewState({ isMyPage: true })
    return
  }

  if (path.startsWith('/room/')) {
    const roomId = decodeURIComponent(path.replace('/room/', ''))
    const matched = findStreamByRoomId(roomId)
    if (matched) {
      setViewState({ stream: matched })
    } else {
      routeToHome()
      if (window.location.pathname !== HOME_PATH) {
        window.history.replaceState({}, '', HOME_PATH)
      }
    }
    return
  }

  routeToHome()
}

const handlePopState = () => {
  applyRouteFromPath(window.location.pathname)
}

const openVideoModal = (stream) => {
  setViewState({ stream })
  const roomId = getRoomIdFromStream(stream)
  if (roomId) {
    pushRoute(`/room/${encodeURIComponent(roomId)}`)
  }
}

const closeVideoModal = () => {
  routeToHome()
  pushRoute(HOME_PATH)
}

const openLoginModal = () => {
  isLoginModalOpen.value = true
}

const closeLoginModal = () => {
  isLoginModalOpen.value = false
}

const openSignupModal = () => {
  isLoginModalOpen.value = false
  isSignupModalOpen.value = true
}

const closeSignupModal = () => {
  isSignupModalOpen.value = false
}

const handleSignupSuccess = () => {
  isSignupModalOpen.value = false
  isLoginModalOpen.value = true
}

const handleLoginSuccess = (userData) => {
  console.log('로그인 성공:', userData)
  isLoggedIn.value = true
  currentUser.value = userData
  // TODO: 추가 사용자 상태 업데이트
}

const clearAuthState = () => {
  isLoggedIn.value = false
  currentUser.value = null
  routeToHome()
  pushRoute(HOME_PATH)
  localStorage.removeItem('userId')
  localStorage.removeItem('token')
  localStorage.removeItem('idToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('tokenExpiresIn')
  localStorage.removeItem('username')
}

const handleLogout = async () => {
  if (isLoggingOut.value) {
    return
  }

  const userId = localStorage.getItem('userId') || currentUser.value?.userId
  isLoggingOut.value = true
  try {
    if (authBaseUrl && userId) {
      const response = await fetch(`${authBaseUrl}/logout/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    }

    clearAuthState()
    console.log('로그아웃 완료')
  } catch (error) {
    console.error('로그아웃 API 호출 실패(로컬 로그아웃으로 진행):', error)
    clearAuthState()
  } finally {
    isLoggingOut.value = false
  }
}

const openMyPage = () => {
  console.log('마이페이지 열기')
  setViewState({ isMyPage: true, isProfileEditPage: false })
  pushRoute(MY_PAGE_PATH)
}

const closeMyPage = () => {
  routeToHome()
  pushRoute(HOME_PATH)
}

const openProfileEditPage = () => {
  setViewState({ isMyPage: false, isProfileEditPage: true })
  pushRoute(`${MY_PAGE_PATH}/edit`)
}

const closeProfileEditPage = () => {
  setViewState({ isMyPage: true, isProfileEditPage: false })
  pushRoute(MY_PAGE_PATH)
}

const handleProfileSaved = (updatedUser) => {
  currentUser.value = {
    ...(currentUser.value || {}),
    ...updatedUser
  }
  closeProfileEditPage()
}

const handleStreamCreated = async () => {
  await loadStreamsFromChatRooms()
}

const mapRoomsToStreams = (rooms, countMap = {}) => {
  return rooms
    .filter((room) => !room?.status || room.status === 'LIVE')
    .map((room, index) => ({
      id: room.roomId,
      roomId: room.roomId,
      title: `${room.name} 라이브`,
      streamer: room.broadcasterId || room.name || `Room ${index + 1}`,
      streamer_id: room.broadcasterId || room.roomId,
      category: '토크',
      viewers: countMap[room.roomId] ?? 0,
      thumbnail: roomThumbnails[index % roomThumbnails.length],
      isLive: true,
      status: room.status,
      tags: ['LIVE', '채팅', room.status]
    }))
}

const loadStreamsFromChatRooms = async () => {
  try {
    const [roomsRes, countsRes] = await Promise.all([
      fetch(`${roomServiceBaseUrl}/rooms`),
      fetch(`${roomServiceBaseUrl}/rooms/counts`),
    ])
    if (!roomsRes.ok) throw new Error(`HTTP ${roomsRes.status}`)
    const rooms = await roomsRes.json()
    if (!Array.isArray(rooms)) throw new Error('Invalid rooms payload')

    let countMap = {}
    if (countsRes.ok) {
      const counts = await countsRes.json()
      countMap = Object.fromEntries(counts.map(c => [c.roomId, c.participants]))
    }
    liveStreams.value = mapRoomsToStreams(rooms, countMap)
  } catch (error) {
    console.error('Error fetching chat rooms from server:', error)
    liveStreams.value = demoModeEnabled ? [...fallbackStreams] : []
  }
}

// 서버 카테고리 로드
const loadCategories = async () => {
  try {
    const response = await fetch(`${roomServiceBaseUrl}/rooms/categories`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    const names = Array.isArray(data)
      ? data.map(item => item?.categoryName).filter(Boolean)
      : []
    const unique = Array.from(new Set(names))
    if (unique.length > 0) {
      categories.value = ['전체', ...unique]
    }
  } catch (error) {
    console.error('Error fetching categories from server:', error)
  }
}

onMounted(async () => {
  await Promise.all([
    loadCategories(),
    loadStreamsFromChatRooms()
  ])

  // localStorage에서 로그인 상태 복원
  const userId = localStorage.getItem('userId')
  const username = localStorage.getItem('username')
  const token = localStorage.getItem('token')
  const idToken = localStorage.getItem('idToken')
  const refreshToken = localStorage.getItem('refreshToken')

  if (userId || token) {
    console.log('로그인 상태 복원:', { userId, username })
    isLoggedIn.value = true
    currentUser.value = {
      userId,
      username,
      token,
      idToken,
      refreshToken
    }
  }

  applyRouteFromPath(window.location.pathname)
  window.addEventListener('popstate', handlePopState)
})

onUnmounted(() => {
  window.removeEventListener('popstate', handlePopState)
})
</script>

<template>
  <div class="app-container">
    <Header
      :searchValue="searchValue"
      :isLoggedIn="isLoggedIn"
      :isLoggingOut="isLoggingOut"
      :currentUser="currentUser"
      @search-input="(val) => searchValue = val"
      @login="openLoginModal"
      @logout="handleLogout"
      @mypage="openMyPage"
      @signup="openSignupModal"
    />

    <div class="layout">
      <Sidebar
        :selectedNav="selectedNav"
        :recommendedStreamers="recommendedStreamers"
        @select-nav="selectNav"
      />

      <main class="main-content">
        <!-- 마이페이지 -->
        <template v-if="showMyPage">
          <MyPage
            :userId="currentUser?.userId"
            @close="closeMyPage"
            @stream-created="handleStreamCreated"
            @edit-profile="openProfileEditPage"
          />
        </template>

        <!-- 프로필 수정 페이지 -->
        <template v-else-if="showProfileEditPage">
          <ProfileEditPage
            :currentUser="currentUser"
            @close="closeProfileEditPage"
            @saved="handleProfileSaved"
          />
        </template>

        <!-- 메인 콘텐츠 영역 -->
        <template v-else-if="!selectedStream">
          <CategorySection
            :categories="categories"
            :selectedCategory="selectedCategory"
            @filter-category="filterByCategory"
          />

          <StreamsGrid :filteredStreams="filteredStreams" @stream-click="openVideoModal" />
        </template>

        <!-- 스트림 재생 영역 -->
        <template v-else>
          <StreamingVideoSection
            :id="selectedStream.id"
            :streamer="selectedStream.streamer"
            :streamer_id="selectedStream.streamer_id"
            :room-id="selectedStream.roomId || selectedStream.id"
            :stream-key="selectedStream.streamKey || selectedStream.roomId || selectedStream.id"
            :title="selectedStream.title"
            :thumbnail="selectedStream.thumbnail"
            :viewers="selectedStream.viewers"
            @close="closeVideoModal"
          />
        </template>
      </main>

      <RightSidebar :trendingItems="trendingItems" />
    </div>

    <!-- Login Modal -->
    <LoginPage
      :isOpen="isLoginModalOpen"
      @close="closeLoginModal"
      @login-success="handleLoginSuccess"
      @signup-request="openSignupModal"
    />

    <SignUpPage
      :isOpen="isSignupModalOpen"
      @close="closeSignupModal"
      @signup-success="handleSignupSuccess"
    />
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background-color: #0e0e10;
  color: #efeff1;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.layout {
  display: flex;
  padding-top: 60px;
  width: 100vw;
  height: calc(100vh - 60px);
}

.main-content {
  flex: 1;
  margin-left: 240px;
  margin-right: 300px;
  padding: 30px 40px;
  min-width: 0;
  overflow-y: auto;
}

.main-content::-webkit-scrollbar {
  width: 8px;
}

.main-content::-webkit-scrollbar-track {
  background: #18181b;
}

.main-content::-webkit-scrollbar-thumb {
  background: #2a2a2e;
  border-radius: 4px;
}

.main-content::-webkit-scrollbar-thumb:hover {
  background: #3a3a3d;
}
</style>
