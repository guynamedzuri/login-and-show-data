# Node.js LTS 버전 이미지 사용
FROM node:16

# 컨테이너 내 작업 디렉터리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm install

# 애플리케이션 소스 코드 복사
COPY . .

# 애플리케이션 실행 포트 설정
EXPOSE 3000

# 애플리케이션 실행 명령어
CMD ["node", "app.js"]