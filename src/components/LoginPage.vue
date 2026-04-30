<script setup>
import { ref } from 'vue'

defineProps({
  isOpen: Boolean
})

const emit = defineEmits(['close', 'login-success', 'signup-request'])

const userId = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const apiBaseUrl = (import.meta.env.VITE_LOGIN_SERVER_URL || '/api').replace(/\/$/, '')
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const handleClose = () => {
  emit('close')
}

const handleSignupRequest = () => {
  emit('signup-request')
}

const handleBackdropClick = (e) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

const handleLogin = async () => {
  const username = userId.value.trim()

  if (!username || !password.value) {
    errorMessage.value = '이메일과 비밀번호를 입력해주세요.'
    return
  }

  if (!emailPattern.test(username)) {
    errorMessage.value = '가입한 이메일 주소를 입력해주세요.'
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password: password.value
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('로그인 성공 - 서버 응답:', data)

      if (data === true || data.success === true) {
        const serverUser = data?.user || {}
        const resolvedUserId = serverUser.id || serverUser.userId || username
        const resolvedUsername = serverUser.username || username

        console.log('저장할 userId:', resolvedUserId)

        const tokens = data?.tokens || {}
        const accessToken = tokens.accessToken || ''

        localStorage.setItem('userId', resolvedUserId)
        localStorage.setItem('username', resolvedUsername)
        if (accessToken) {
          localStorage.setItem('token', accessToken)
        }
        if (tokens.idToken) {
          localStorage.setItem('idToken', tokens.idToken)
        }
        if (tokens.refreshToken) {
          localStorage.setItem('refreshToken', tokens.refreshToken)
        }
        if (tokens.expiresIn) {
          localStorage.setItem('tokenExpiresIn', String(tokens.expiresIn))
        }
        console.log('userId 저장 완료:', resolvedUserId)

        const userData = {
          userId: resolvedUserId,
          username: resolvedUsername,
          token: accessToken,
          isLoggedIn: true
        }

        emit('login-success', userData)
        handleClose()
      } else {
        errorMessage.value = '로그인에 실패했습니다.'
      }
    } else {
      const error = await response.json()
      errorMessage.value = error.message || '로그인에 실패했습니다.'
    }
  } catch (error) {
    console.error('로그인 오류:', error)
    errorMessage.value = '서버와 연결할 수 없습니다.'
  } finally {
    isLoading.value = false
  }
}

const handleKeyPress = (event) => {
  if (event.key === 'Enter') {
    handleLogin()
  }
}
</script>

<template>
  <transition name="modal-fade">
    <div v-if="isOpen" class="login-backdrop" @click="handleBackdropClick">
      <div class="login-modal">
        <div class="login-header">
          <h2 class="login-title">로그인</h2>
          <button class="close-btn" @click="handleClose">✕</button>
        </div>

        <form class="login-form" @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="userId" class="form-label">이메일</label>
            <input
              id="userId"
              v-model="userId"
              type="email"
              placeholder="이메일을 입력하세요"
              class="form-input"
              @keypress="handleKeyPress"
              :disabled="isLoading"
            />
          </div>

          <div class="form-group">
            <label for="password" class="form-label">비밀번호</label>
            <input
              id="password"
              v-model="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              class="form-input"
              @keypress="handleKeyPress"
              :disabled="isLoading"
            />
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <button type="submit" class="login-btn" :disabled="isLoading">
            {{ isLoading ? '로그인 중...' : '로그인' }}
          </button>
        </form>

        <div class="login-footer">
          <a href="#" class="footer-link">비밀번호를 잊으셨나요?</a>
          <div class="signup-link">
            계정이 없으신가요?
            <a href="#" class="link-primary" @click.prevent="handleSignupRequest">회원가입</a>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.login-backdrop {
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

.login-modal {
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

.login-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px;
  border-bottom: 1px solid #2a2a2e;
}

.login-title {
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

.login-form {
  padding: 28px;
}

.form-group {
  margin-bottom: 20px;
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
  box-sizing: border-box;
}

.form-input:focus {
  background-color: #3a3a3d;
  border-color: #00ffa3;
}

.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: #6e6e7a;
}

.error-message {
  background-color: rgba(247, 0, 69, 0.1);
  border: 1px solid #f70045;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  color: #ff6b9d;
  font-size: 13px;
  text-align: center;
}

.login-btn {
  width: 100%;
  background: linear-gradient(135deg, #00ffa3 0%, #00d9ff 100%);
  color: #0e0e10;
  border: none;
  padding: 14px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 255, 163, 0.3);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.login-footer {
  padding: 20px 28px 24px;
  border-top: 1px solid #2a2a2e;
  text-align: center;
}

.footer-link {
  display: block;
  color: #b8b8bf;
  font-size: 13px;
  text-decoration: none;
  margin-bottom: 12px;
  transition: color 0.2s;
}

.footer-link:hover {
  color: #efeff1;
}

.signup-link {
  font-size: 13px;
  color: #b8b8bf;
}

.link-primary {
  color: #00ffa3;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.link-primary:hover {
  color: #00d9ff;
}

/* Transition Animation */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-to,
.modal-fade-leave-from {
  opacity: 1;
}

/* 반응형 */
@media (max-width: 480px) {
  .login-modal {
    width: 95%;
    max-width: none;
  }

  .login-header,
  .login-form,
  .login-footer {
    padding-left: 20px;
    padding-right: 20px;
  }
}
</style>
