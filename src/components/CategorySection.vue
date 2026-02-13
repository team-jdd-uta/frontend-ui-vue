<script setup>
import { toRefs } from 'vue'

const props = defineProps({
  categories: {
    type: Array,
    default: () => []
  },
  selectedCategory: String
})

const { categories } = toRefs(props)

defineEmits(['filter-category'])
</script>

<template>
  <div class="category-section">
    <div class="category-header">
      <h2 class="section-title">카테고리</h2>
    </div>
    <div class="category-container">
      <button
        v-for="category in categories"
        :key="category"
        :class="['category-btn', { active: selectedCategory === category }]"
        @click="$emit('filter-category', category)"
      >
        {{ category }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.category-section {
  margin-bottom: 30px;
}

.category-header {
  margin-bottom: 15px;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #efeff1;
}

.category-container {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.category-btn {
  background-color: #2a2a2e;
  color: #b8b8bf;
  border: none;
  padding: 10px 20px;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  transition: all 0.2s;
}

.category-btn:hover {
  background-color: #3a3a3d;
  color: #efeff1;
  transform: translateY(-2px);
}

.category-btn.active {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  font-weight: 700;
}
</style>
