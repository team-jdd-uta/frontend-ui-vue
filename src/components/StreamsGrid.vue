<script setup>
import StreamCard from './StreamCard.vue'

defineProps({
  filteredStreams: Array
})

defineEmits(['stream-click'])

const formatViewers = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K'
  }
  return count.toString()
}
</script>

<template>
  <div class="streams-section">
    <div class="section-header">
      <h2 class="section-title">
        <span class="live-indicator">🔴</span>
        LIVE
        <span class="stream-count">({{ filteredStreams.length }})</span>
      </h2>
      <div class="sort-options">
        <button class="sort-btn active">인기순</button>
        <button class="sort-btn">최신순</button>
        <button class="sort-btn">시청자순</button>
      </div>
    </div>

    <div class="streams-grid">
      <StreamCard
        v-for="stream in filteredStreams"
        :key="stream.id"
        :stream="stream"
        @stream-click="$emit('stream-click', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.streams-section {
  margin-top: 30px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #efeff1;
}

.live-indicator {
  font-size: 20px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.stream-count {
  font-size: 18px;
  color: #b8b8bf;
  font-weight: 500;
}

.sort-options {
  display: flex;
  gap: 8px;
}

.sort-btn {
  background: none;
  border: 1px solid #2a2a2e;
  color: #b8b8bf;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.sort-btn:hover {
  border-color: #53535f;
  color: #efeff1;
}

.sort-btn.active {
  background-color: #2a2a2e;
  border-color: #00ffa3;
  color: #00ffa3;
}

.streams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  width: 100%;
}
</style>

