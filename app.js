// ============================================================
// 데이터 정의
// ============================================================
const QUESTIONS = [
  { key: 'q1', text: '나는 내 의견을 적극적으로 주장하는 편이다' },
  { key: 'q2', text: '나는 실수를 했을 때 솔직하게 인정하고 드러낸다' },
  { key: 'q3', text: '나는 새로운 아이디어를 거리낌없이 제안한다' },
  { key: 'q4', text: '나는 상대방의 말을 경청하고 배우려는 자세를 보인다' },
  { key: 'q5', text: '나는 내 성과나 기여도를 적극적으로 어필한다' },
]
const JOB_LEVELS = ['사원/주임', '대리/과장', '차장 이상']
const SCALE_LABELS = ['전혀 아니다', '아니다', '보통이다', '그렇다', '매우 그렇다']

const WORK_COLOR = '#1b2333'
const MBA_COLOR = '#e8a33d'

// ============================================================
// Supabase 클라이언트
// ============================================================
if (!window.SUPABASE_URL || window.SUPABASE_URL.includes('YOUR_PROJECT_REF')) {
  console.warn('[config.js] Supabase URL/키가 아직 설정되지 않았습니다. config.js를 채워주세요.')
}
const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)

// ============================================================
// 상태
// ============================================================
const state = {
  jobLevel: null,
  answers: {}, // { work_q1: 3, mba_q1: 5, ... }
}
QUESTIONS.forEach((q) => {
  state.answers[`work_${q.key}`] = null
  state.answers[`mba_${q.key}`] = null
})

let charts = { bar: null, radar: null, group: null }

// ============================================================
// 탭 전환
// ============================================================
const tabBtnSurvey = document.getElementById('tab-btn-survey')
const tabBtnResults = document.getElementById('tab-btn-results')
const tabSurvey = document.getElementById('tab-survey')
const tabResults = document.getElementById('tab-results')

function showTab(name) {
  const isSurvey = name === 'survey'
  tabBtnSurvey.classList.toggle('active', isSurvey)
  tabBtnResults.classList.toggle('active', !isSurvey)
  tabSurvey.classList.toggle('hidden', !isSurvey)
  tabResults.classList.toggle('hidden', isSurvey)
  if (!isSurvey) loadResults()
}

tabBtnSurvey.addEventListener('click', () => showTab('survey'))
tabBtnResults.addEventListener('click', () => showTab('results'))

// ============================================================
// 설문 폼 렌더링
// ============================================================
function renderSurveyForm() {
  let html = `
    <div class="card">
      <h2>설문에 참여하기</h2>
      <p class="sub">
        각 문항을 "직장에서의 나"와 "MBA 수업(조별과제)에서의 나" 두 기준으로
        따로 응답해주세요. 솔직할수록 결과가 흥미로워집니다.
      </p>

      <label class="field-label">현재 직급</label>
      <div class="select-pills" id="job-level-pills">
        ${JOB_LEVELS.map((lvl) => `<button type="button" data-level="${lvl}">${lvl}</button>`).join('')}
      </div>
  `

  QUESTIONS.forEach((q, idx) => {
    html += `
      <div class="q-block">
        <div class="q-text">${idx + 1}. ${q.text}</div>
        ${renderScaleRow('직장에서', 'work', q.key)}
        ${renderScaleRow('MBA에서', 'mba', q.key)}
        <div class="scale-caption">
          <span>${SCALE_LABELS[0]}</span>
          <span>${SCALE_LABELS[4]}</span>
        </div>
      </div>
    `
  })

  html += `
      <div class="error-msg hidden" id="form-error"></div>
      <button class="submit-btn" id="submit-btn" type="button">응답 제출하고 결과 보기</button>
    </div>
  `

  tabSurvey.innerHTML = html
  attachSurveyListeners()
}

function renderScaleRow(label, type, qKey) {
  const field = `${type}_${qKey}`
  const buttons = [1, 2, 3, 4, 5]
    .map((n) => `<button type="button" data-field="${field}" data-value="${n}">${n}</button>`)
    .join('')
  return `
    <div class="q-row">
      <div class="q-row-label ${type}">${label}</div>
      <div class="scale" data-field-group="${field}">${buttons}</div>
    </div>
  `
}

function attachSurveyListeners() {
  // 직급 선택
  document.querySelectorAll('#job-level-pills button').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.jobLevel = btn.dataset.level
      document.querySelectorAll('#job-level-pills button').forEach((b) =>
        b.classList.toggle('selected', b === btn)
      )
    })
  })

  // 5점 척도 선택
  document.querySelectorAll('.scale button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.field
      const value = Number(btn.dataset.value)
      state.answers[field] = value

      const type = field.startsWith('work_') ? 'work' : 'mba'
      const group = document.querySelector(`[data-field-group="${field}"]`)
      group.querySelectorAll('button').forEach((b) => {
        b.classList.toggle('selected', Number(b.dataset.value) === value)
        b.classList.toggle(type, Number(b.dataset.value) === value)
      })
    })
  })

  document.getElementById('submit-btn').addEventListener('click', handleSubmit)
}

async function handleSubmit() {
  const errorEl = document.getElementById('form-error')
  const allAnswered = Object.values(state.answers).every((v) => v !== null)

  if (!state.jobLevel || !allAnswered) {
    errorEl.textContent = '모든 문항에 응답하고 직급을 선택해주세요.'
    errorEl.classList.remove('hidden')
    return
  }
  errorEl.classList.add('hidden')

  const submitBtn = document.getElementById('submit-btn')
  submitBtn.disabled = true
  submitBtn.textContent = '제출 중...'

  const payload = { job_level: state.jobLevel, ...state.answers }
  const { error } = await sb.from('responses').insert(payload)

  submitBtn.disabled = false
  submitBtn.textContent = '응답 제출하고 결과 보기'

  if (error) {
    console.error(error)
    errorEl.textContent = '제출 중 오류가 발생했습니다. config.js의 Supabase 설정을 확인해주세요.'
    errorEl.classList.remove('hidden')
    return
  }

  // 폼 초기화
  state.jobLevel = null
  QUESTIONS.forEach((q) => {
    state.answers[`work_${q.key}`] = null
    state.answers[`mba_${q.key}`] = null
  })
  renderSurveyForm()
  showTab('results')
}

// ============================================================
// 통계 계산
// ============================================================
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)

function computeQuestionStats(rows) {
  return QUESTIONS.map((q, i) => {
    const workVals = rows.map((r) => r[`work_${q.key}`]).filter((v) => v != null)
    const mbaVals = rows.map((r) => r[`mba_${q.key}`]).filter((v) => v != null)
    const workAvg = avg(workVals)
    const mbaAvg = avg(mbaVals)
    return {
      shortLabel: `Q${i + 1}`,
      question: q.text,
      workAvg: Number(workAvg.toFixed(2)),
      mbaAvg: Number(mbaAvg.toFixed(2)),
      gap: Number((mbaAvg - workAvg).toFixed(2)),
    }
  })
}

function computeGroupGap(rows) {
  return JOB_LEVELS.map((level) => {
    const groupRows = rows.filter((r) => r.job_level === level)
    if (groupRows.length === 0) return { level, n: 0, avgGap: 0 }
    const gaps = groupRows.map((r) => {
      const workVals = QUESTIONS.map((q) => r[`work_${q.key}`]).filter((v) => v != null)
      const mbaVals = QUESTIONS.map((q) => r[`mba_${q.key}`]).filter((v) => v != null)
      return avg(mbaVals) - avg(workVals)
    })
    return { level, n: groupRows.length, avgGap: Number(avg(gaps).toFixed(2)) }
  })
}

// ============================================================
// 결과 화면 렌더링
// ============================================================
async function loadResults() {
  tabResults.innerHTML = `<div class="card empty-state">불러오는 중...</div>`

  const { data: rows, error } = await sb.from('responses').select('*')

  if (error) {
    console.error(error)
    tabResults.innerHTML = `<div class="card empty-state">데이터를 불러오지 못했습니다. config.js의 Supabase 설정을 확인해주세요.</div>`
    return
  }

  if (!rows || rows.length === 0) {
    tabResults.innerHTML = `<div class="card empty-state">아직 응답이 없습니다. 첫 번째 응답을 남겨보세요!</div>`
    return
  }

  renderResults(rows)
}

function renderResults(rows) {
  const questionStats = computeQuestionStats(rows)
  const groupGap = computeGroupGap(rows)
  const overallGap = Number(
    (questionStats.reduce((s, q) => s + q.gap, 0) / questionStats.length).toFixed(2)
  )
  const gapDesc =
    overallGap > 0 ? ' (MBA에서 더 개방적)' : overallGap < 0 ? ' (직장에서 더 개방적)' : ' (동일)'

  tabResults.innerHTML = `
    <div class="stat-row">
      <div class="stat-pill"><span class="live-dot" id="live-dot"></span><b>${rows.length}</b>명 응답 (실시간)</div>
      <div class="stat-pill">평균 자아 갭 <b>${overallGap > 0 ? '+' + overallGap : overallGap}</b>${gapDesc}</div>
    </div>

    <div class="card">
      <h2>문항별 직장 vs MBA 평균</h2>
      <div class="chart-caption">같은 질문에 대해 "직장에서"와 "MBA에서" 응답한 평균 점수를 나란히 비교합니다.</div>
      <div class="legend-row">
        <span><span class="legend-dot" style="background:${WORK_COLOR}"></span>직장</span>
        <span><span class="legend-dot" style="background:${MBA_COLOR}"></span>MBA</span>
      </div>
      <div class="chart-box"><canvas id="chart-bar"></canvas></div>
    </div>

    <div class="card">
      <h2>자아 갭 레이더</h2>
      <div class="chart-caption">각 문항에서 (MBA 평균 − 직장 평균)이 클수록, 그 항목에서 "MBA에서의 나"가 더 개방적/적극적이라는 뜻입니다.</div>
      <div class="chart-box"><canvas id="chart-radar"></canvas></div>
    </div>

    <div class="card">
      <h2>직급별 평균 갭 비교</h2>
      <div class="chart-caption">직급이 낮을수록 "두 자아"의 차이가 더 클 것이라는 가설을 검증합니다. (표본 5명 미만인 그룹은 참고용으로만 보세요.)</div>
      <div class="chart-box short"><canvas id="chart-group"></canvas></div>
      ${
        groupGap.some((g) => g.n > 0 && g.n < 5)
          ? `<div class="chart-caption" style="margin-top:8px;margin-bottom:0">⚠ 일부 직급 그룹의 응답자 수가 5명 미만이라 평균이 불안정할 수 있습니다.</div>`
          : ''
      }
    </div>

    <div class="card about">
      <h2>이 설문에 대하여</h2>

      <h3>왜 이 문항들을 선택했는가</h3>
      <p>
        토요일 아침 MBA 강의실에 앉아있는 사람들은 대부분 평일엔 직장인입니다. 같은 사람이
        "회사에서의 나"와 "조별과제에서의 나"로 하루아침에 다른 태도를 보이는 경우를 자주
        목격하면서, 이 간극을 숫자로 확인해보고 싶었습니다. 자기주장, 실수 인정, 아이디어 제안,
        경청, 성과 어필이라는 다섯 가지 행동은 조직행동론에서 심리적 안전감(psychological
        safety)과 밀접한 항목들로, 위계와 평가 부담이 있는 직장과 상대적으로 수평적인 스터디
        조직 사이에서 가장 크게 갈릴 것으로 예상해 선정했습니다.
      </p>

      <h3>추가 기능과 그 이유</h3>
      <p>
        단순 평균 비교를 넘어, (1) 문항별 갭을 레이더 차트로 시각화해 "어느 행동에서 자아
        분열이 가장 큰지" 한눈에 보이도록 했고, (2) 직급별 갭 비교를 추가해 "직급이 낮을수록
        직장에서 더 위축되고 MBA에서 더 해방되는가"라는 가설을 검증할 수 있게 했습니다.
        (3) Supabase 실시간 구독을 붙여 누군가 응답을 제출하는 순간 다른 접속자의 화면에도
        새로고침 없이 반영되도록 했는데, 이는 설문이 "살아있는 상태"로 누적되는 과정 자체를
        보여주고 싶었기 때문입니다.
      </p>
    </div>
  `

  drawCharts(questionStats, groupGap)
}

function drawCharts(questionStats, groupGap) {
  if (charts.bar) charts.bar.destroy()
  if (charts.radar) charts.radar.destroy()
  if (charts.group) charts.group.destroy()

  const barCtx = document.getElementById('chart-bar')
  charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: questionStats.map((q) => q.shortLabel),
      datasets: [
        { label: '직장', data: questionStats.map((q) => q.workAvg), backgroundColor: WORK_COLOR, borderRadius: 4 },
        { label: 'MBA', data: questionStats.map((q) => q.mbaAvg), backgroundColor: MBA_COLOR, borderRadius: 4 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => questionStats[items[0].dataIndex].question,
          },
        },
      },
      scales: { y: { min: 0, max: 5 } },
    },
  })

  const radarCtx = document.getElementById('chart-radar')
  charts.radar = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: questionStats.map((q) => q.shortLabel),
      datasets: [
        {
          label: 'MBA - 직장 갭',
          data: questionStats.map((q) => q.gap),
          backgroundColor: 'rgba(232,163,61,0.4)',
          borderColor: MBA_COLOR,
          pointBackgroundColor: MBA_COLOR,
        },
      ],
    },
    options: { maintainAspectRatio: false },
  })

  const groupCtx = document.getElementById('chart-group')
  charts.group = new Chart(groupCtx, {
    type: 'bar',
    data: {
      labels: groupGap.map((g) => g.level),
      datasets: [
        {
          label: '평균 갭',
          data: groupGap.map((g) => g.avgGap),
          backgroundColor: groupGap.map((g) => (g.avgGap >= 0 ? MBA_COLOR : WORK_COLOR)),
          borderRadius: 4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => `평균 갭 ${item.raw} (n=${groupGap[item.dataIndex].n})`,
          },
        },
      },
    },
  })
}

// ============================================================
// 실시간 구독: 다른 사람이 응답을 제출하면 결과 탭이 켜져있을 때 자동 갱신
// ============================================================
sb.channel('responses-realtime')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'responses' }, () => {
    const liveDot = document.getElementById('live-dot')
    if (liveDot) {
      liveDot.style.opacity = '1'
    }
    if (!tabResults.classList.contains('hidden')) {
      loadResults()
    }
  })
  .subscribe()

// ============================================================
// 초기 렌더링
// ============================================================
renderSurveyForm()
