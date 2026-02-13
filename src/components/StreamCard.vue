<script setup>
import { onMounted } from 'vue'

const props = defineProps({
  stream: Object
})

const emit = defineEmits(['stream-click'])

const formatViewers = (count) => {
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'K'
  }
  return count.toString()
}

const handleCardClick = () => {
  emit('stream-click', props.stream)
}

const serverUrl = import.meta.env.VITE_APP_SERVER_URL


</script>

<template>
  <div class="stream-card" @click="handleCardClick">
    <div class="thumbnail-wrapper">
      <img :src="stream.thumbnail" :alt="stream.title" class="thumbnail" />
      <div class="thumbnail-overlay">
        <span class="live-badge">LIVE</span>
        <span class="viewers-badge">
          <span class="viewers-icon">👁</span>
          {{ formatViewers(stream.viewers) }}
        </span>
      </div>
    </div>
    <div class="stream-info">
      <div class="streamer-header">
        <div class="streamer-avatar-small">{{ stream.streamer.charAt(0) }}</div>
        <div class="streamer-details">
          <h3 class="stream-title">{{ stream.title }}</h3>
          <p class="stream-streamer">{{ stream.streamer }}</p>
        </div>
      </div>
      <div class="stream-meta">
        <span class="stream-category">{{ stream.category }}</span>
        <div class="stream-tags">
          <span v-for="tag in stream.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stream-card {
  background-color: #18181b;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.stream-card:hover {
  transform: translateY(-4px);
  border-color: #00ffa3;
  box-shadow: 0 12px 24px rgba(0, 255, 163, 0.2);
}

.thumbnail-wrapper {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  overflow: hidden;
  background-color: #0e0e10;
}

.thumbnail {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.stream-card:hover .thumbnail {
  transform: scale(1.05);
}

.thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.live-badge {
  background-color: #f70045;
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(247, 0, 69, 0.4);
}

.viewers-badge {
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  gap: 4px;
}

.viewers-icon {
  font-size: 14px;
}

.stream-info {
  padding: 12px;
}

.streamer-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.streamer-avatar-small {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: white;
  flex-shrink: 0;
}

.streamer-details {
  flex: 1;
  min-width: 0;
}

.stream-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
  color: #efeff1;
  margin: 0;
}

.stream-streamer {
  color: #b8b8bf;
  font-size: 13px;
  font-weight: 500;
  margin: 0;
}

.stream-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stream-category {
  display: inline-block;
  background-color: #2a2a2e;
  color: #b8b8bf;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  width: fit-content;
}

.stream-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  background-color: rgba(0, 255, 163, 0.1);
  color: #00ffa3;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
}
</style>

