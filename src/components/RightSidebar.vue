<script setup>
defineProps({
  trendingItems: Array
})

const formatViewers = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K'
  }
  return count.toString()
}
</script>

<template>
  <aside class="right-sidebar">
    <div class="trending-section">
      <h3 class="sidebar-title">🔥 실시간 인기</h3>
      <div class="trending-list">
        <div class="trending-item" v-for="(item, index) in trendingItems" :key="index">
          <span class="trending-rank">{{ index + 1 }}</span>
          <div class="trending-info">
            <div class="trending-title">{{ item.title }}</div>
            <div class="trending-category">{{ item.category }}</div>
          </div>
          <div class="trending-viewers">{{ formatViewers(item.viewers) }}</div>
        </div>
      </div>
    </div>

    <div class="ad-section">
      <div class="ad-placeholder">
        <p>광고 영역</p>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.right-sidebar {
  width: 300px;
  background-color: #18181b;
  border-left: 1px solid #2a2a2e;
  position: fixed;
  right: 0;
  top: 60px;
  bottom: 0;
  overflow-y: auto;
  padding: 20px;
}

.trending-section {
  margin-bottom: 30px;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: #b8b8bf;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 15px;
  margin: 0 0 15px 0;
}

.trending-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 15px;
}

.trending-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background-color: #2a2a2e;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.trending-item:hover {
  background-color: #3a3a3d;
  transform: translateX(4px);
}

.trending-rank {
  font-size: 18px;
  font-weight: 700;
  color: #00ffa3;
  width: 24px;
  text-align: center;
}

.trending-info {
  flex: 1;
  min-width: 0;
}

.trending-title {
  font-size: 13px;
  font-weight: 600;
  color: #efeff1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.trending-category {
  font-size: 11px;
  color: #b8b8bf;
}

.trending-viewers {
  font-size: 12px;
  font-weight: 600;
  color: #b8b8bf;
}

.ad-section {
  margin-top: 30px;
}

.ad-placeholder {
  background: linear-gradient(135deg, #2a2a2e 0%, #3a3a3d 100%);
  border: 2px dashed #53535f;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  color: #6e6e7a;
  font-size: 14px;
  font-weight: 600;
}

.ad-placeholder p {
  margin: 0;
}

.right-sidebar::-webkit-scrollbar {
  width: 8px;
}

.right-sidebar::-webkit-scrollbar-track {
  background: #18181b;
}

.right-sidebar::-webkit-scrollbar-thumb {
  background: #2a2a2e;
  border-radius: 4px;
}

.right-sidebar::-webkit-scrollbar-thumb:hover {
  background: #3a3a3d;
}
</style>

