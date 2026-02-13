<script setup>
import { computed } from 'vue'

const props = defineProps({
  searchValue: String,
  isLoggedIn: {
    type: Boolean,
    default: false
  },
  currentUser: {
    type: Object,
    default: null
  }
})

defineEmits(['search-input', 'search-click', 'login', 'logout', 'mypage', 'signup'])

const displayName = computed(() => {
  if (props.currentUser?.username) {
    return props.currentUser.username
  }
  if (props.currentUser?.email) {
    return props.currentUser.email
  }
  const username = localStorage.getItem('username')
  if (username) {
    console.log('로컬 스토리지 username:', username)
    return username
  }
  const userId = localStorage.getItem('userId')
  console.log('로컬 스토리지 userId:', userId)
  if (userId) {
    return userId
  }
  return '사용자'
})
</script>

<template>
  <header class="header">
    <div class="header-content">
      <div class="logo-section">
        <h1 class="logo">UTA</h1>
      </div>
      <div class="search-bar">
        <input
          type="text"
          placeholder="스트리머, 게임, 카테고리 검색"
          class="search-input"
          :value="searchValue"
          @input="$emit('search-input', $event.target.value)"
        />
        <button class="search-btn" @click="$emit('search-click')">🔍</button>
      </div>
      <div class="header-actions">
        <button class="btn-icon">🔔</button>
        <button class="btn-icon">⚙️</button>

        <!-- 로그인 상태에 따른 조건부 렌더링 -->
        <template v-if="isLoggedIn">
          <div class="user-profile">
            <button class="user-name-btn" @click="$emit('mypage')">
              {{ displayName }}
            </button>
          </div>
          <button class="btn-logout" @click="$emit('logout')">로그아웃</button>
        </template>
        <template v-else>
          <button class="btn-login" @click="$emit('login')">로그인</button>
          <button class="btn-signup" @click="$emit('signup')">회원가입</button>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  background-color: #18181b;
  border-bottom: 1px solid #2a2a2e;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: 60px;
}

.header-content {
  height: 100%;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.logo {
  font-size: 1.75rem;
  font-weight: 800;
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 50%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  cursor: pointer;
  white-space: nowrap;
}

.search-bar {
  flex: 1;
  max-width: 500px;
  display: flex;
  background-color: #2a2a2e;
  border-radius: 6px;
  overflow: hidden;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  padding: 10px 15px;
  color: #efeff1;
  font-size: 14px;
  outline: none;
}

.search-input::placeholder {
  color: #6e6e7a;
}

.search-btn {
  background: none;
  border: none;
  color: #efeff1;
  padding: 0 15px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.search-btn:hover {
  background-color: #3a3a3d;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.btn-icon {
  background: none;
  border: none;
  color: #efeff1;
  font-size: 18px;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-icon:hover {
  background-color: #2a2a2e;
}

.btn-login {
  background: none;
  border: 1px solid #53535f;
  color: #efeff1;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-login:hover {
  background-color: #2a2a2e;
}

.btn-signup {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  transition: transform 0.2s;
  white-space: nowrap;
}

.btn-signup:hover {
  transform: scale(1.05);
}

.user-profile {
  display: flex;
  align-items: center;
  margin-right: 8px;
}

.user-name-btn {
  background: none;
  border: 1px solid #53535f;
  color: #efeff1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: all 0.2s;
}

.user-name-btn:hover {
  background-color: #2a2a2e;
  border-color: #00ffa3;
  color: #00ffa3;
  transform: translateY(-1px);
}

.btn-logout {
  background: none;
  border: 1px solid #f70045;
  color: #f70045;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-logout:hover {
  background-color: rgba(247, 0, 69, 0.1);
  transform: translateY(-1px);
}
</style>

