<script setup>
import { ref, computed, onMounted } from 'vue'
import Header from './components/Header.vue'
import Sidebar from './components/Sidebar.vue'
import CategorySection from './components/CategorySection.vue'
import StreamsGrid from './components/StreamsGrid.vue'
import RightSidebar from './components/RightSidebar.vue'
import StreamingVideoSection from './components/StreamingVideoSection.vue'

const selectedCategory = ref('전체')
const selectedNav = ref('홈')
const searchValue = ref('')
const selectedStream = ref(null)
const defaultCategories = ['게임', '토크', '음악', '스포츠', '요리', '예술', '크리에이티브', '학습']
const categories = ref(['전체', ...defaultCategories])
const serverUrl = import.meta.env.VITE_APP_SERVER_URL

// 로컬 이미지 (public/images 폴더에 저장)
//방 정보 하드코딩
const liveStreams = ref([
  {
    id: 1,
    title: '즐거운 게임 방송 - 리그오브레전드 랭크 도전!',
    streamer: '게이머스트리머',
    streamer_id: "user_003",
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
    streamer_id: "user_004",
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
    streamer_id: "user_005",
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
    streamer_id: "user_005",
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
    streamer_id: "user_006",
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
    streamer_id: "user_007",
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
    streamer_id: "user_008",
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
    streamer_id: "user_009",
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
    streamer_id: "user_010",
    category: '게임',
    viewers: 15670,
    thumbnail: '/images/stream-9.jpg',
    isLive: true,
    tags: ['오버워치', '랭크', 'FPS']
  }
])
const recommendedStreamers = ref([
  { name: '정찬혁', avatar: '👨‍💼', viewers: 45600, isLive: true },
  { name: '김현문', avatar: '👩‍🎤', viewers: 32100, isLive: true },
  { name: '김유빈', avatar: '👨‍🎨', viewers: 28900, isLive: true },
  { name: '페이커', avatar: '👩‍💻', viewers: 19800, isLive: false },
  { name: '손흥민', avatar: '👨‍🍳', viewers: 12300, isLive: true }
])

const trendingItems = computed(() => {
  return liveStreams.value.slice(0, 5).map(stream => ({
    title: stream.title,
    category: stream.category,
    viewers: stream.viewers
  }))
})

const filteredStreams = computed(() => {
  if (selectedCategory.value === '전체') {
    return liveStreams.value
  } else {
    return liveStreams.value.filter(stream => stream.category === selectedCategory.value)
  }
})

const filterByCategory = (category) => {
  selectedCategory.value = category
}

const selectNav = (nav) => {
  selectedNav.value = nav
}

const openVideoModal = (stream) => {
  selectedStream.value = stream
}

const closeVideoModal = () => {
  selectedStream.value = null
}

// 서버 카테고리 로드
const loadCategories = async () => {
  if (!serverUrl) {
    console.warn('VITE_APP_SERVER_URL 환경 변수가 설정되지 않았습니다.')
    return
  }

  try {
    const response = await fetch(`${serverUrl}/categories`)
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

onMounted(() => {
  loadCategories()
})
</script>

<template>
  <div class="app-container">
    <Header
      :searchValue="searchValue"
      @search-input="(val) => searchValue = val"
      @login="() => {}"
      @signup="() => {}"
    />

    <div class="layout">
      <Sidebar
        :selectedNav="selectedNav"
        :recommendedStreamers="recommendedStreamers"
        @select-nav="selectNav"
      />

      <main class="main-content">
        <!-- 메인 콘텐츠 영역 -->
        <template v-if="!selectedStream">
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
            :streamer="selectedStream.streamer"
            :streamer_id="selectedStream.streamer_id"
            :title="selectedStream.title"
            :thumbnail="selectedStream.thumbnail"
            :viewers="selectedStream.viewers"
            @close="closeVideoModal"
          />
        </template>
      </main>

      <RightSidebar :trendingItems="trendingItems" />
    </div>
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
</style>
