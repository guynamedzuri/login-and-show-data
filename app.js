require('dotenv').config(); // dotenv 패키지 로드

const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const session = require('express-session');
const cors = require('cors');
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