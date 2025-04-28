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
      <div class="verify-container">
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

// 복리후생 리스트 데이터
const welfareList = [
  { id: 1, title: '[복리후생/제휴] 시우역_호텔스퀘어 이용 안내', description: '직원들의 건강을 위해 연 1회 건강검진을 지원합니다.' },
  { id: 2, title: '리조트 사용신청 안내_한화리조트/소노호텔&리조트', description: '직원의 자녀 학자금을 지원합니다.' },
  { id: 3, title: '[복리후생/제휴]2025년 봄나들이 특별 판매 (티켓드림)', description: '사내 동호회 활동비를 지원합니다.' },
  { id: 4, title: '[복리후생/제휴] 2025년 3월 아이코젠 이용 안내의 건', description: '직원들을 위한 휴양시설을 제공합니다.' },
];

// 인증 성공 페이지 (복리후생 리스트)
app.get('/success', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect('/');
  }

  // HTML 렌더링
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>복리후생 리스트</title>
      <link rel="stylesheet" href="/styles.css">
    </head>
    <body>
      <div class="container">
        <h1>LSA 임직원을 위한 복리후생 리스트!</h1>
        <ul class="welfare-list">
          ${welfareList.map(item => `
            <li>
              <a href="/welfare/${item.id}" class="welfare-link">${item.title}</a>
            </li>
          `).join('')}
        </ul>
      </div>
    </body>
    </html>
  `);
});

// 복리후생 상세 페이지
app.get('/welfare/:id', (req, res) => {
  if (!req.session.isAuthenticated) {
    return res.redirect('/'); // 인증되지 않은 경우 메인 페이지로 리다이렉트
  }

  const welfareId = parseInt(req.params.id, 10);
  const welfareItem = welfareList.find(item => item.id === welfareId);

  if (!welfareItem) {
    return res.status(404).send('<h1>404 - 복리후생 정보를 찾을 수 없습니다.</h1>');
  }

  const filePath = path.join(__dirname, 'public', 'contents', `${welfareId}.html`);

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('파일 읽기 오류:', err);
      return res.status(500).send('파일을 읽는 중 오류가 발생했습니다.');
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${welfareItem.title}</title>
        <link rel="stylesheet" href="/styles.css">
      </head>
      <body>
        <div class="container">
          <h1>${welfareItem.title}</h1>
          ${data}
          <a href="/success" class="back-link">← 복리후생 리스트로 돌아가기</a>
        </div>
      </body>
      </html>
    `);
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});