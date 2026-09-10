(() => {
  const CANVAS_W = 900;
  const CANVAS_H = 480;
  const GROUND_Y = 420;
  const LAUNCH_X = 90;
  const G = 260; // px/s^2 (교육용 단순화 값, 실제 SI 단위 아님)

  const MASS_A = 5;
  const MASS_B = 1;

  const COLOR_A = '#d94f4f';
  const COLOR_B = '#3b6fb0';
  const COLOR_RESULTANT = '#2f9e5b';

  const FORCE_ARROW_SCALE = 0.22;

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const state = {
    trailMode: 'persist',
    showVectors: true,
    scenario: 'default',
    running: false,
    paused: false,
    lastTs: null,
    balls: null,
  };

  function makeBallState(angleDeg, speed, mass, color) {
    const rad = angleDeg * Math.PI / 180;
    return {
      mass,
      color,
      angleDeg,
      speed,
      vx: speed * Math.cos(rad),
      vy0: speed * Math.sin(rad),
      x: LAUNCH_X,
      y: GROUND_Y,
      t: 0,
      landed: false,
      landX: null,
      landT: null,
      trail: [],
    };
  }

  // 사전 시나리오는 매번 같은 결과를 보여주도록 고정값을 사용한다 (무작위 아님).
  const FIXED_SCENARIOS = {
    default: { angleA: 55, speedA: 230, angleB: 35, speedB: 290 },
    sameAngle: { angleA: 45, speedA: 220, angleB: 45, speedB: 300 },
    sameSpeed: { angleA: 35, speedA: 260, angleB: 65, speedB: 260 },
  };

  function buildScenario(name) {
    return FIXED_SCENARIOS[name] || null;
  }

  const manual = {
    angleDeg: 45,
    force: 170,
    diffMode: 'force',
    forceDiff: 0,
    angleDiff: 0,
  };

  const FORCE_TO_SPEED_K = 1.05;

  function buildManualScenario() {
    const baseSpeed = manual.force * FORCE_TO_SPEED_K;
    let angleA = manual.angleDeg;
    let angleB = manual.angleDeg;
    let speedA = baseSpeed;
    let speedB = baseSpeed;

    if (manual.diffMode === 'force') {
      speedB = Math.max(20, baseSpeed + manual.forceDiff * FORCE_TO_SPEED_K);
    } else {
      angleB = Math.min(85, Math.max(5, manual.angleDeg + manual.angleDiff));
    }
    return { angleA, angleB, speedA, speedB };
  }

  function setIdleBalls() {
    state.balls = {
      A: makeBallState(0, 0, MASS_A, COLOR_A),
      B: makeBallState(0, 0, MASS_B, COLOR_B),
    };
    state.running = false;
    state.paused = false;
    draw();
  }

  function launch(values) {
    state.balls = {
      A: makeBallState(values.angleA, values.speedA, MASS_A, COLOR_A),
      B: makeBallState(values.angleB, values.speedB, MASS_B, COLOR_B),
    };
    state.running = true;
    state.paused = false;
    state.lastTs = null;
    setResult('시뮬레이션 진행 중...');
    requestAnimationFrame(step);
  }

  function runCurrentScenario() {
    document.getElementById('stopBtn').textContent = '정지';
    const name = state.scenario;
    const values = name === 'manual' ? buildManualScenario() : buildScenario(name);
    launch(values);
  }

  function updateBall(ball, dt) {
    if (ball.landed) return;
    ball.t += dt;
    const x = LAUNCH_X + ball.vx * ball.t;
    const y = GROUND_Y - (ball.vy0 * ball.t - 0.5 * G * ball.t * ball.t);

    if (y >= GROUND_Y) {
      const landT = (2 * ball.vy0) / G;
      ball.landed = true;
      ball.landT = landT;
      ball.x = LAUNCH_X + ball.vx * landT;
      ball.y = GROUND_Y;
      ball.landX = ball.x;
    } else {
      ball.x = x;
      ball.y = y;
    }

    ball.trail.push({ x: ball.x, y: ball.y, t: performance.now() });
  }

  function step(ts) {
    if (!state.running) return;
    if (state.paused) {
      state.lastTs = ts;
      requestAnimationFrame(step);
      return;
    }
    if (state.lastTs === null) state.lastTs = ts;
    const dt = Math.min(0.032, (ts - state.lastTs) / 1000);
    state.lastTs = ts;

    const { A, B } = state.balls;
    updateBall(A, dt);
    updateBall(B, dt);

    draw();

    if (A.landed && B.landed) {
      finishRun();
      return;
    }
    requestAnimationFrame(step);
  }

  function finishRun() {
    state.running = false;
    const { A, B } = state.balls;
    const dx = Math.abs(A.landX - B.landX);
    const dt = Math.abs(A.landT - B.landT);
    const samePlace = dx < 3;
    const sameTime = dt < 0.03;
    let verdict;
    if (samePlace && sameTime) {
      verdict = '두 공이 같은 시간, 같은 지점에 도착했습니다! (속력·각도가 완전히 같을 때만 가능)';
    } else {
      verdict = `도착 지점 차이 약 ${dx.toFixed(0)}px, 도착 시각 차이 약 ${dt.toFixed(2)}초 — 같은 시간·같은 지점에 도착하지 못했습니다.`;
    }
    setResult(
      `공 A(5kg): 각도 ${A.angleDeg.toFixed(1)}°, 속력 ${A.speed.toFixed(0)}, 도착시각 ${A.landT.toFixed(2)}초, 도착지점 x=${A.landX.toFixed(0)}px<br>` +
      `공 B(1kg): 각도 ${B.angleDeg.toFixed(1)}°, 속력 ${B.speed.toFixed(0)}, 도착시각 ${B.landT.toFixed(2)}초, 도착지점 x=${B.landX.toFixed(0)}px<br>` +
      `<strong>${verdict}</strong>`
    );
  }

  function setResult(html) {
    document.getElementById('resultBar').innerHTML = html;
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = '#3a4451';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();

    ctx.fillStyle = '#5b6572';
    ctx.beginPath();
    ctx.arc(LAUNCH_X, GROUND_Y, 3, 0, Math.PI * 2);
    ctx.fill();

    if (!state.balls) return;
    const { A, B } = state.balls;

    drawTrail(A);
    drawTrail(B);

    if (state.showVectors) drawForceVectors(A, B);

    drawBall(A);
    drawBall(B);
    drawMassLabels(A, B);
  }

  function drawTrail(ball) {
    if (state.trailMode === 'none' || ball.trail.length < 2) return;

    if (state.trailMode === 'persist') {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = ball.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ball.trail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
      return;
    }

    const now = performance.now();
    const FADE_MS = 900;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    for (let i = 1; i < ball.trail.length; i++) {
      const p0 = ball.trail[i - 1];
      const p1 = ball.trail[i];
      const age = now - p1.t;
      if (age > FADE_MS) continue;
      const alpha = 1 - age / FADE_MS;
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = ball.color;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();

    ball.trail = ball.trail.filter(p => now - p.t <= FADE_MS);
  }

  function drawBall(ball) {
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMassLabels(A, B) {
    ctx.font = '11px sans-serif';
    const dist = Math.hypot(A.x - B.x, A.y - B.y);
    if (dist < 14) {
      ctx.fillStyle = A.color;
      ctx.fillText(`A ${A.mass}kg`, A.x + 12, A.y - 22);
      ctx.fillStyle = B.color;
      ctx.fillText(`B ${B.mass}kg`, B.x + 12, B.y - 8);
    } else {
      ctx.fillStyle = A.color;
      ctx.fillText(`A ${A.mass}kg`, A.x + 12, A.y - 10);
      ctx.fillStyle = B.color;
      ctx.fillText(`B ${B.mass}kg`, B.x + 12, B.y - 10);
    }
  }

  function drawArrow(x, y, dx, dy, color) {
    const toX = x + dx;
    const toY = y + dy;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    const angle = Math.atan2(dy, dx);
    const headLen = 8;
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  function drawForceVectors(A, B) {
    const forceA = MASS_A * (G / 100);
    const forceB = MASS_B * (G / 100);

    drawArrow(A.x, A.y, 0, forceA * FORCE_ARROW_SCALE * 10, COLOR_A);
    drawArrow(B.x, B.y, 0, forceB * FORCE_ARROW_SCALE * 10, COLOR_B);

    const midX = (A.x + B.x) / 2;
    const midY = Math.min(A.y, B.y) - 40;
    const resultant = forceA + forceB;
    drawArrow(midX, midY, 0, resultant * FORCE_ARROW_SCALE * 10, COLOR_RESULTANT);
    ctx.fillStyle = COLOR_RESULTANT;
    ctx.font = '11px sans-serif';
    ctx.fillText('합력', midX + 6, midY + 10);
  }

  document.getElementById('runBtn').addEventListener('click', runCurrentScenario);

  document.getElementById('stopBtn').addEventListener('click', (e) => {
    if (!state.running) return;
    state.paused = !state.paused;
    e.target.textContent = state.paused ? '계속하기' : '정지';
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('stopBtn').textContent = '정지';
    setIdleBalls();
    setResult('설정은 유지된 채 초기화되었습니다. ▶ 실행 버튼을 눌러 다시 발사하세요.');
  });

  const vectorBtn = document.getElementById('vectorToggleBtn');
  vectorBtn.addEventListener('click', () => {
    state.showVectors = !state.showVectors;
    vectorBtn.textContent = `힘 벡터 표시: ${state.showVectors ? '켜짐' : '꺼짐'}`;
    vectorBtn.classList.toggle('active', state.showVectors);
    draw();
  });

  document.querySelectorAll('#trailModeGroup .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#trailModeGroup .mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.trailMode = btn.dataset.trail;
    });
  });

  const manualPanel = document.getElementById('manualPanel');
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.scenario = btn.dataset.scenario;
      manualPanel.hidden = state.scenario !== 'manual';
      document.getElementById('stopBtn').textContent = '정지';
      setIdleBalls();
      setResult('두 공이 같은 출발점에 서 있습니다. ▶ 실행 버튼을 누르면 동시에 발사됩니다.');
    });
  });

  const angleDial = document.getElementById('angleDial');
  const angleHandle = document.getElementById('angleHandle');
  const angleNeedle = document.getElementById('angleNeedle');
  const angleValueEl = document.getElementById('angleValue');
  const DIAL_CX = 100, DIAL_CY = 100, DIAL_R = 80;

  function setDialAngle(deg) {
    manual.angleDeg = deg;
    const rad = deg * Math.PI / 180;
    const hx = DIAL_CX + DIAL_R * Math.cos(rad);
    const hy = DIAL_CY - DIAL_R * Math.sin(rad);
    angleHandle.setAttribute('cx', hx);
    angleHandle.setAttribute('cy', hy);
    angleNeedle.setAttribute('x2', hx);
    angleNeedle.setAttribute('y2', hy);
    angleValueEl.textContent = deg.toFixed(0);
  }
  setDialAngle(manual.angleDeg);

  let draggingDial = false;
  function dialPointToAngle(evt) {
    const rect = angleDial.getBoundingClientRect();
    const scaleX = 200 / rect.width;
    const scaleY = 120 / rect.height;
    const px = (evt.clientX - rect.left) * scaleX;
    const py = (evt.clientY - rect.top) * scaleY;
    let deg = Math.atan2(DIAL_CY - py, px - DIAL_CX) * 180 / Math.PI;
    return Math.min(90, Math.max(0, deg));
  }
  angleDial.addEventListener('pointerdown', (e) => {
    draggingDial = true;
    setDialAngle(dialPointToAngle(e));
  });
  window.addEventListener('pointermove', (e) => {
    if (!draggingDial) return;
    setDialAngle(dialPointToAngle(e));
  });
  window.addEventListener('pointerup', () => { draggingDial = false; });

  const forceSlider = document.getElementById('forceSlider');
  const forceValueEl = document.getElementById('forceValue');
  forceSlider.addEventListener('input', () => {
    manual.force = Number(forceSlider.value);
    forceValueEl.textContent = manual.force;
  });

  const forceDiffSlider = document.getElementById('forceDiffSlider');
  const forceDiffValueEl = document.getElementById('forceDiffValue');
  forceDiffSlider.addEventListener('input', () => {
    manual.forceDiff = Number(forceDiffSlider.value);
    forceDiffValueEl.textContent = manual.forceDiff;
  });

  const angleDiffSlider = document.getElementById('angleDiffSlider');
  const angleDiffValueEl = document.getElementById('angleDiffValue');
  angleDiffSlider.addEventListener('input', () => {
    manual.angleDiff = Number(angleDiffSlider.value);
    angleDiffValueEl.textContent = manual.angleDiff;
  });

  document.querySelectorAll('input[name="diffMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      manual.diffMode = e.target.value;
      forceDiffSlider.disabled = manual.diffMode !== 'force';
      angleDiffSlider.disabled = manual.diffMode !== 'angle';
    });
  });
  angleDiffSlider.disabled = true;

  setIdleBalls();
})();
