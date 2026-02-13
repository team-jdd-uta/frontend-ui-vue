# 로컬 이미지 설정 가이드

이 프로젝트는 `public/images` 폴더에 로컬 이미지 파일을 저장하여 사용하도록 설정되어 있습니다.

## 📁 디렉토리 구조

```
public/
└── images/
    ├── stream-1.jpg
    ├── stream-2.jpg
    ├── stream-3.jpg
    ├── stream-4.jpg
    ├── stream-5.jpg
    ├── stream-6.jpg
    ├── stream-7.jpg
    ├── stream-8.jpg
    └── stream-9.jpg
```

## 🖼️ 이미지 추가 방법

### 방법 1: 기존 이미지 파일 복사
1. `public/images` 폴더에 원하는 이미지 파일을 복사하세요
2. 파일명을 `stream-1.jpg`, `stream-2.jpg` 등으로 지정하세요
3. 자동으로 반영됩니다

### 방법 2: 온라인 이미지 사용 (임시)
`src/App.vue`의 `liveStreams` 배열에서 `thumbnail` 경로를 다음과 같이 수정할 수 있습니다:

```javascript
thumbnail: 'https://via.placeholder.com/400x225/667eea/ffffff?text=League+of+Legends',
```

### 방법 3: PowerShell로 더미 이미지 생성

다음 명령어를 PowerShell에서 실행하여 기본 색상의 이미지를 생성할 수 있습니다:

```powershell
# PowerShell 스크립트로 이미지 생성 (Windows 전용)
# 색상 목록: 667eea, 764ba2, f093fb, 4facfe, 00f2fe, 43e97b, a8edea, fed6e3, c471f5

# 예시: stream-1.jpg 생성
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(400, 225)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0x667eea))
$graphics.FillRectangle($brush, 0, 0, 400, 225)
$graphics.Dispose()
$bitmap.Save('C:\Users\SKAX\IdeaProjects\uta_ui\public\images\stream-1.jpg')
```

## 📝 App.vue에서의 사용 예시

```javascript
thumbnail: '/images/stream-1.jpg',  // public 폴더를 기준으로 경로 지정
```

## ✅ 체크리스트

- [ ] `public/images` 폴더에 이미지 파일 추가
- [ ] 파일명이 정확한지 확인 (stream-1.jpg ~ stream-9.jpg)
- [ ] 이미지 해상도: 400x225px (권장)
- [ ] 개발 서버 재시작

## 🎨 권장 이미지 해상도
- **너비**: 400px
- **높이**: 225px
- **종횡비**: 16:9 (스트림 썸네일 표준)

## 📌 참고사항

- `.jpg`, `.png`, `.webp` 등 모든 이미지 형식 지원
- `public` 폴더의 파일은 빌드 시 자동으로 최상위 디렉토리에 복사됨
- 경로는 항상 `/images/filename.jpg` 형식으로 사용하세요

