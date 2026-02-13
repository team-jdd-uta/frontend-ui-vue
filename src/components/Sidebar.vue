<script setup>
defineProps({
  selectedNav: String,
  recommendedStreamers: Array
})

defineEmits(['select-nav'])

const formatViewers = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K'
  }
  return count.toString()
}
</script>

<template>
  <aside class="sidebar">
    <nav class="sidebar-nav">
      <a
        href="#"
        :class="['nav-item', { active: selectedNav === '홈' }]"
        @click.prevent="$emit('select-nav', '홈')"
      >
        <span class="nav-icon">🏠</span>
        <span class="nav-text">홈</span>
      </a>
      <a
        href="#"
        :class="['nav-item', { active: selectedNav === '팔로잉' }]"
        @click.prevent="$emit('select-nav', '팔로잉')"
      >
        <span class="nav-icon">⭐</span>
        <span class="nav-text">팔로잉</span>
      </a>
      <a
        href="#"
        :class="['nav-item', { active: selectedNav === '카테고리' }]"
        @click.prevent="$emit('select-nav', '카테고리')"
      >
        <span class="nav-icon">📁</span>
        <span class="nav-text">카테고리</span>
      </a>
      <a
        href="#"
        :class="['nav-item', { active: selectedNav === '인기' }]"
        @click.prevent="$emit('select-nav', '인기')"
      >
        <span class="nav-icon">🔥</span>
        <span class="nav-text">인기 LIVE</span>
      </a>
    </nav>

    <div class="sidebar-section">
      <h3 class="sidebar-title">추천 스트리머</h3>
      <div class="streamer-list">
        <div
          v-for="streamer in recommendedStreamers"
          :key="streamer.name"
          class="streamer-item"
        >
          <div class="streamer-avatar">{{ streamer.avatar }}</div>
          <div class="streamer-info">
            <div class="streamer-name">{{ streamer.name }}</div>
            <div class="streamer-status">
              <span v-if="streamer.isLive" class="status-live">● LIVE</span>
              <span v-else class="status-offline">● 오프라인</span>
              <span v-if="streamer.isLive" class="streamer-viewers">{{ formatViewers(streamer.viewers) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 240px;
  background-color: #18181b;
  border-right: 1px solid #2a2a2e;
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  overflow-y: auto;
  padding: 20px 0;
}

.sidebar-nav {
  margin-bottom: 30px;
  padding: 0 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  color: #b8b8bf;
  text-decoration: none;
  border-radius: 8px;
  margin-bottom: 4px;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-item:hover {
  background-color: #2a2a2e;
  color: #efeff1;
}

.nav-item.active {
  background: linear-gradient(90deg, rgba(0, 255, 163, 0.15) 0%, rgba(0, 217, 255, 0.15) 100%);
  color: #00ffa3;
  font-weight: 600;
}

.nav-icon {
  font-size: 20px;
}

.nav-text {
  font-size: 14px;
}

.sidebar-section {
  padding: 0 10px;
  margin-top: 20px;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: #b8b8bf;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 15px;
  padding: 0 15px;
}

.streamer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.streamer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.streamer-item:hover {
  background-color: #2a2a2e;
}

.streamer-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}

.streamer-info {
  flex: 1;
  min-width: 0;
}

.streamer-name {
  font-size: 13px;
  font-weight: 600;
  color: #efeff1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.streamer-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  margin-top: 2px;
}

.status-live {
  color: #f70045;
  font-weight: 600;
}

.status-offline {
  color: #6e6e7a;
}

.streamer-viewers {
  color: #b8b8bf;
}

.sidebar::-webkit-scrollbar {
  width: 8px;
}

.sidebar::-webkit-scrollbar-track {
  background: #18181b;
}

.sidebar::-webkit-scrollbar-thumb {
  background: #2a2a2e;
  border-radius: 4px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: #3a3a3d;
}
</style>

