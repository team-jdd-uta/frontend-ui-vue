<script setup>
import { computed, reactive, watch } from 'vue'

const props = defineProps({
  currentUser: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['close', 'saved'])

const apiBaseUrl = (import.meta.env.VITE_USER_INFO_SERVER_URL || '').replace(/\/$/, '')

const form = reactive({
  userId: '',
  username: '',
  email: ''
})

const state = reactive({
  isSaving: false,
  errorMessage: ''
})

const initialUserId = computed(() => props.currentUser?.userId || localStorage.getItem('userId') || '')

watch(
  () => props.currentUser,
  (value) => {
    form.userId = value?.userId || localStorage.getItem('userId') || ''
    form.username = value?.username || localStorage.getItem('username') || form.userId
    form.email = value?.email || ''
  },
  { immediate: true, deep: true }
)

const handleClose = () => {
  if (state.isSaving) {
    return
  }

  emit('close')
}

const handleSave = async () => {
  state.errorMessage = ''

  const payload = {
    userId: form.userId || initialUserId.value,
    username: form.username.trim() || form.userId || initialUserId.value,
    email: form.email.trim()
  }

  if (!payload.userId) {
    state.errorMessage = '아이디를 찾을 수 없습니다.'
    return
  }

  state.isSaving = true

  try {
    const response = await fetch(`${apiBaseUrl}/users/${encodeURIComponent(payload.userId)}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: payload.username,
        email: payload.email
      })
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      state.errorMessage = data?.message || '프로필 저장에 실패했습니다.'
      return
    }

    const savedUser = {
      userId: payload.userId,
      username: data?.username || payload.username,
      email: data?.email || payload.email
    }

    localStorage.setItem('username', savedUser.username)
    if (savedUser.email) {
      localStorage.setItem('email', savedUser.email)
    }

    emit('saved', savedUser)
  } catch (error) {
    console.error('프로필 저장 오류:', error)
    state.errorMessage = '서버와 연결할 수 없습니다.'
  } finally {
    state.isSaving = false
  }
}
</script>

<template>
  <div class="profile-edit-page">
    <div class="profile-edit-header">
      <button class="back-btn" @click="handleClose">
        <span class="back-icon">←</span>
        마이페이지로 돌아가기
      </button>
      <h1 class="page-title">프로필 수정</h1>
    </div>

    <div class="profile-edit-content">
      <div class="edit-card">
        <div class="edit-avatar">{{ (form.username || form.userId || 'U').charAt(0).toUpperCase() }}</div>

        <div class="edit-form">
          <div v-if="state.errorMessage" class="error-message">
            {{ state.errorMessage }}
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-userId">아이디</label>
            <input id="edit-userId" v-model="form.userId" type="text" class="form-input" disabled />
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-username">닉네임</label>
            <input id="edit-username" v-model="form.username" type="text" class="form-input" placeholder="닉네임을 입력하세요" />
          </div>

          <div class="form-group">
            <label class="form-label" for="edit-email">이메일</label>
            <input id="edit-email" v-model="form.email" type="email" class="form-input" placeholder="이메일을 입력하세요" />
          </div>

          <div class="button-row">
            <button class="secondary-btn" type="button" @click="handleClose" :disabled="state.isSaving">취소</button>
            <button class="primary-btn" type="button" @click="handleSave" :disabled="state.isSaving">
              {{ state.isSaving ? '저장 중...' : '저장' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-edit-page {
  min-height: 100vh;
  background-color: #0e0e10;
  color: #efeff1;
}

.profile-edit-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 30px;
  border-bottom: 1px solid #2a2a2e;
  background-color: #18181b;
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

.profile-edit-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 30px;
}

.edit-card {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  background: linear-gradient(180deg, #18181b 0%, #121214 100%);
  border: 1px solid #2a2a2e;
  border-radius: 16px;
  padding: 28px;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
}

.edit-avatar {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  font-size: 36px;
  font-weight: 800;
  flex-shrink: 0;
}

.edit-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #b8b8bf;
}

.form-input {
  width: 100%;
  background-color: #2a2a2e;
  border: 1px solid transparent;
  padding: 12px 14px;
  border-radius: 8px;
  color: #efeff1;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  background-color: #333338;
  border-color: #00ffa3;
}

.form-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.error-message {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(247, 0, 69, 0.45);
  background-color: rgba(247, 0, 69, 0.12);
  color: #ff8fb1;
  font-size: 13px;
}

.button-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 6px;
}

.secondary-btn,
.primary-btn {
  border: none;
  border-radius: 8px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s, background-color 0.2s;
}

.secondary-btn {
  background-color: #2a2a2e;
  color: #efeff1;
}

.secondary-btn:disabled,
.primary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.primary-btn {
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
}

.secondary-btn:hover,
.primary-btn:hover {
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .profile-edit-header,
  .profile-edit-content {
    padding-left: 20px;
    padding-right: 20px;
  }

  .edit-card {
    flex-direction: column;
    align-items: stretch;
  }

  .edit-avatar {
    align-self: center;
  }

  .button-row {
    justify-content: stretch;
  }

  .secondary-btn,
  .primary-btn {
    flex: 1;
  }
}
</style>
