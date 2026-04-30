<script setup>
import { ref } from 'vue'

defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'signup-success'])

const userId = ref('')
const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const apiBaseUrl = (import.meta.env.VITE_LOGIN_SERVER_URL || '/api').replace(/\/$/, '')
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

const resetMessages = () => {
  errorMessage.value = ''
  successMessage.value = ''
}

const handleClose = () => {
  if (isLoading.value) {
    return
  }
  emit('close')
}

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

const handleSignup = async () => {
  resetMessages()
  const username = userId.value.trim()

  if (!username || !password.value) {
    errorMessage.value = '이메일과 비밀번호를 입력해주세요.'
    return
  }

  if (!emailPattern.test(username)) {
    errorMessage.value = '이메일 주소 형식으로 가입해주세요.'
    return
  }

  if (!passwordPattern.test(password.value)) {
    errorMessage.value = '비밀번호는 8자 이상이며 대문자, 소문자, 숫자를 포함해야 합니다.'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMessage.value = '비밀번호 확인이 일치하지 않습니다.'
    return
  }

  isLoading.value = true
  try {
    const response = await fetch(
      `${apiBaseUrl}/register`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username,
          password: password.value
        })
      }
    )

    const data = await response.json().catch(() => null)

    if (response.status === 201 && (data === true || data?.success === true)) {
      successMessage.value = '회원가입이 완료되었습니다. 로그인해 주세요.'
      setTimeout(() => {
        emit('signup-success')
      }, 400)
    } else if (response.status === 409) {
      errorMessage.value = data?.message || '이미 존재하는 계정입니다.'
    } else {
      errorMessage.value = data?.message || '회원가입에 실패했습니다.'
    }
  } catch (error) {
    console.error('회원가입 오류:', error)
    errorMessage.value = '회원가입 요청에 실패했습니다.'
  } finally {
    isLoading.value = false
  }
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    handleSignup()
  }
}
</script>

<template>
  <transition name="modal-fade">
    <div v-if="isOpen" class="signup-backdrop" @click="handleBackdropClick">
      <div class="signup-modal">
        <div class="signup-header">
          <h2 class="signup-title">회원가입</h2>
          <button class="close-btn" @click="handleClose">✕</button>
        </div>

        <form class="signup-form" @submit.prevent="handleSignup">
          <div class="form-group">
            <label for="signup-userId" class="form-label">이메일</label>
            <input
              id="signup-userId"
              v-model="userId"
              type="email"
              placeholder="이메일을 입력하세요"
              class="form-input"
              :disabled="isLoading"
              @keypress="handleKeyPress"
            />
          </div>

          <div class="form-group">
            <label for="signup-password" class="form-label">비밀번호</label>
            <input
              id="signup-password"
              v-model="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              class="form-input"
              :disabled="isLoading"
              @keypress="handleKeyPress"
            />
          </div>

          <div class="form-group">
            <label for="signup-confirm-password" class="form-label">비밀번호 확인</label>
            <input
              id="signup-confirm-password"
              v-model="confirmPassword"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              class="form-input"
              :disabled="isLoading"
              @keypress="handleKeyPress"
            />
          </div>

          <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
          <div v-if="successMessage" class="success-message">{{ successMessage }}</div>

          <button type="submit" class="signup-btn" :disabled="isLoading">
            {{ isLoading ? '가입 중...' : '회원가입' }}
          </button>
        </form>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.signup-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
  backdrop-filter: blur(4px);
}

.signup-modal {
  background-color: #18181b;
  border-radius: 16px;
  width: 90%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.signup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px;
  border-bottom: 1px solid #2a2a2e;
}

.signup-title {
  font-size: 24px;
  font-weight: 700;
  color: #efeff1;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  color: #b8b8bf;
  font-size: 24px;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
  padding: 0;
}

.close-btn:hover {
  background-color: #2a2a2e;
  color: #efeff1;
}

.signup-form {
  padding: 28px;
}

.form-group {
  margin-bottom: 18px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #efeff1;
}

.form-input {
  width: 100%;
  background-color: #2a2a2e;
  border: 2px solid transparent;
  padding: 12px 16px;
  border-radius: 8px;
  color: #efeff1;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.form-input:focus {
  border-color: #00ffa3;
}

.form-input:disabled {
  opacity: 0.6;
}

.error-message {
  margin-bottom: 12px;
  color: #ff6b6b;
  font-size: 13px;
}

.success-message {
  margin-bottom: 12px;
  color: #00ffa3;
  font-size: 13px;
}

.signup-btn {
  width: 100%;
  border: none;
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  font-size: 15px;
  font-weight: 700;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
}

.signup-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
