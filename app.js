require('dotenv').config(); // dotenv 패키지 로드

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const session = require('express-session');
const cors = require('cors');

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
app.use(express.static('public'));

// Nodemailer 설정
const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE, // .env에서 가져온 값
  auth: {
    user: process.env.SMTP_USER, // .env에서 가져온 값
    pass: process.env.SMTP_PASS, // .env에서 가져온 값
  },
});

// 랜덤 인증번호 생성 함수
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 이메일 인증번호 요청 처리
app.post('/send-code', (req, res) => {
  const email = `${req.body.email}@lsautomotive.com`;
  // 인증번호 생성 및 이메일 전송 로직
  res.redirect('/verify');
});

// 인증번호 입력 페이지
app.get('/verify', (req, res) => {
  if (!req.session.authCode) {
    return res.redirect('/');
  }
  res.send(`
    <h1>인증번호 입력</h1>
    <form id="verifyForm" action="/verify-code" method="POST">
      <label for="code">인증번호:</label>
      <input type="text" id="code" name="code">
      <button type="submit">인증</button>
    </form>
    <p id="timer"></p>
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
  res.send('<h1>인증 성공!</h1>');
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});