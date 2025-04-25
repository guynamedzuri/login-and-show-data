require('dotenv').config(); // dotenv 패키지 로드

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 세션 설정
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Nodemailer 설정
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Gmail SMTP 서버
  port: 587, // TLS를 사용하는 포트
  secure: false, // TLS를 사용하려면 false로 설정
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// 랜덤 인증번호 생성 함수
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 이메일 인증번호 요청 처리
app.post('/send-code', (req, res) => {
  const email = req.body.email; // 이메일 아이디
  const domain = req.body.domain; // 도메인
  const fullEmail = `${email}@${domain}`; // 전체 이메일 주소 조합

  // 인증번호 생성
  const authCode = generateCode();
  console.log('생성된 인증번호:', authCode);

  // 인증번호를 세션에 저장
  req.session.authCode = authCode;
  req.session.authCodeExpires = Date.now() + 5 * 60 * 1000; // 5분 후 만료

  // 이메일 전송
  transporter.sendMail({
    from: process.env.SMTP_USER,
    to: fullEmail,
    subject: '인증번호 요청',
    text: `인증번호는 ${authCode}입니다. 5분 안에 입력해주세요.`,
  }, (err, info) => {
    if (err) {
      console.error('이메일 전송 실패:', err);
      return res.status(500).send('이메일 전송에 실패했습니다.');
    }
    console.log('이메일 전송 성공:', info.response);

    // 인증번호 입력 페이지로 리다이렉트
    res.redirect('/verify');
  });
});

// GET 요청 처리 추가
app.get('/send-code', (req, res) => {
  res.redirect('/'); // 클라이언트를 메인 페이지로 리다이렉트
});

// 인증번호 입력 페이지
app.get('/verify', (req, res) => {
  if (!req.session.authCode) {
    return res.redirect('/'); // 인증번호가 없으면 메인 페이지로 리다이렉트
  }
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>인증번호 입력</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <h1 align="center">인증번호 입력</h1>
        <form id="verifyForm" action="/verify-code" method="POST">
          <label for="code">인증번호:</label>
          <input type="text" id="code" name="code" placeholder="인증번호 입력">
          <button type="submit">인증</button>
        </form>
        <p id="timer"></p>
      </div>
      <script>
        const expiresAt = ${req.session.authCodeExpires};
        const timer = document.getElementById('timer');
        function updateTimer() {
          const now = Date.now();
          const remaining = Math.max(0, expiresAt - now);
          const seconds = Math.floor(remaining / 1000);
          timer.textContent = \`남은 시간: \${seconds}초\`;
          if (remaining > 0) {
            setTimeout(updateTimer, 1000);
          } else {
            timer.textContent = '인증번호가 만료되었습니다.';
          }
        }
        updateTimer();
      </script>
    </body>
    </html>
  `);
});

// 인증번호 검증
app.post('/verify-code', (req, res) => {
  const { code } = req.body;
  if (req.session.authCode === code && Date.now() < req.session.authCodeExpires) {
    req.session.isAuthenticated = true;
    return res.redirect('/success');
  }
  res.send('<h1>인증 실패</h1><a href="/">다시 시도</a>');
});

// 인증 성공 페이지
app.get('/success', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect('/');
  }

  // 사진 폴더 경로
  const imagesDir = path.join(__dirname, 'public/images');

  // 폴더 내 이미지 파일 읽기
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      console.error('이미지 파일을 읽는 중 오류 발생:', err);
      return res.status(500).send('이미지 파일을 로드할 수 없습니다.');
    }

    // 이미지 파일만 필터링 (jpg, png 등)
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));

    // HTML 렌더링
    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>인증 성공</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <div id="imageViewer">
            <img id="currentImage" src="/images/${imageFiles[0]}" alt="이미지" style="max-width: 100%; height: auto;">
          </div>
          <div id="buttonContainer" align="center">
          <button id="prevButton" style="display: none;">이전</button>
          <button id="nextButton">다음</button>
          </div>
        </div>
        <script>
          const imageFiles = ${JSON.stringify(imageFiles)};
          let currentIndex = 0;

          const prevButton = document.getElementById('prevButton');
          const nextButton = document.getElementById('nextButton');
          const currentImage = document.getElementById('currentImage');

          // 이전 버튼 클릭
          prevButton.addEventListener('click', () => {
            if (currentIndex > 0) {
              currentIndex--;
              currentImage.src = '/images/' + imageFiles[currentIndex];
              updateButtons();
            }
          });

          // 다음 버튼 클릭
          nextButton.addEventListener('click', () => {
            if (currentIndex < imageFiles.length - 1) {
              currentIndex++;
              currentImage.src = '/images/' + imageFiles[currentIndex];
              updateButtons();
            }
          });

          // 버튼 상태 업데이트
          function updateButtons() {
            prevButton.style.display = currentIndex === 0 ? 'none' : 'inline-block';
            nextButton.style.display = currentIndex === imageFiles.length - 1 ? 'none' : 'inline-block';
          }

          // 초기 버튼 상태 설정
          updateButtons();
        </script>
      </body>
      </html>
    `);
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});