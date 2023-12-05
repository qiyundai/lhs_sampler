function setUpQuery(params) {
  let query = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?';

  Object.entries(params).forEach((entry, index) => {
    query += `${index > 0 ? '&' : ''}${entry[0]}=${entry[1]}`;
  })

  return query;
}

function median(numbers) {
  const sorted = Array.from(numbers).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function sum(numbers) {
  return Array.from(numbers).reduce((partialSum, a) => partialSum + a, 0);
}

function hidePage(selector) {
  return new Promise((resolve) => {
    const page = document.querySelector(selector);
    if (!page) resolve();
  
    page.classList.add('transparent');
    setTimeout(() => {
      page.classList.add('hidden');
      resolve();
    }, 200)
  })
}

function getDotClass(score) {
  if (score >= 90) return 'green';

  if (50 <= score < 90) return 'orange';

  if (score < 50) return 'red';
}

function showPage(selector) {
  const page = document.querySelector(selector);
  if (!page) return;

  page.classList.remove('hidden');
  setTimeout(() => {
    page.classList.remove('transparent');
  }, 10)
}

function togglePages(hideSelector, showSelector) {
  hidePage(hideSelector).then(() => {
    showPage(showSelector);
  })
}

async function fetchAndUpdateState(query, state) {
  return new Promise((resolve) => {
    fetch(query)
    .then(response => response.json())
    .then(json => {
      state.perfScore.push(json.lighthouseResult.categories.performance.score * 100);
      state.clsVal.push(json.lighthouseResult.audits["cumulative-layout-shift"].numericValue * 100);
      state.clsScore.push(json.lighthouseResult.audits["cumulative-layout-shift"].score * 100);
      state.lcpVal.push(json.lighthouseResult.audits["largest-contentful-paint"].numericValue);
      state.lcpScore.push(json.lighthouseResult.audits["largest-contentful-paint"].score * 100);
      state.tbtVal.push(json.lighthouseResult.audits["total-blocking-time"].numericValue);
      state.tbtScore.push(json.lighthouseResult.audits["total-blocking-time"].score * 100);
      state.siVal.push(json.lighthouseResult.audits["speed-index"].numericValue);
      state.siScore.push(json.lighthouseResult.audits["speed-index"].score * 100);
      state.fetchCounter += 1;
      resolve();
    });
  })
}

function showResult(payload) {
  const {
    targetSize,
    perfScore,
    clsVal,
    clsScore,
    lcpVal,
    lcpScore,
    tbtVal,
    tbtScore,
    siVal,
    siScore,
    strategy,
    formula,
  } = payload;
  togglePages('#loading-page', '#result-page');

  const resultPage = document.getElementById('result-page');
  
  const sizePH = resultPage.querySelector('#size-placeholder');
  const strategyPH = resultPage.querySelector('#strategy-placeholder');
  const perfScoreEl = resultPage.querySelector('#average-perf-score');
  const clsValEl = resultPage.querySelector('#average-cls-val');
  const lcpValEl = resultPage.querySelector('#average-lcp-val');
  const tbtValEl = resultPage.querySelector('#average-tbt-val');
  const siValEl = resultPage.querySelector('#average-si-val');

  const perfDot = resultPage.querySelector('#perf-result .result-color-dot');
  const tbtDot = resultPage.querySelector('#tbt-result .result-color-dot');
  const clsDot = resultPage.querySelector('#cls-result .result-color-dot');
  const lcpDot = resultPage.querySelector('#lcp-result .result-color-dot');
  const siDot = resultPage.querySelector('#si-result .result-color-dot');

  const formulaPHs = resultPage.querySelectorAll('.output-formula');

  sizePH.textContent = targetSize;
  strategyPH.textContent = strategy;
  perfScoreEl.textContent = `${Math.floor(perfScore)}`;
  clsValEl.textContent = `${clsVal.toFixed(2)}%`;
  lcpValEl.textContent = `${(lcpVal / 1000).toFixed(2)}s`;
  tbtValEl.textContent = `${Math.floor(tbtVal)}ms`;
  siValEl.textContent = `${(siVal / 1000).toFixed(2)}s`;

  const dots = [perfDot, tbtDot, clsDot, lcpDot, siDot];
  const scores = [perfScore, tbtScore, clsScore, lcpScore, siScore];

  dots.forEach((dot, index) => {
    dot.classList.add(getDotClass(scores[index]));
  })

  formulaPHs.forEach((span) => {
    span.textContent = formula;
  })
}

function forceWait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

async function launchSampler(configs) {
  togglePages('#input-page', '#loading-page');

  const queryParams = {
    strategy: configs.strategy,
  }

  const state = {
    perfScore: [],
    clsVal: [],
    clsScore: [],
    lcpVal: [],
    lcpScore: [],
    tbtVal: [],
    tbtScore: [],
    siVal: [],
    siScore: [],
    fetchCounter: 0,
    targetSize: configs.size,
  }

  const stateProxy = new Proxy(state, {
    set: (state, key, value) => {
      const progressBarFill = document.getElementById('progress-bar-fill');
  
      if (progressBarFill) {
        progressBarFill.style.maxWidth = `${((state.fetchCounter + 1) / state.targetSize) * 100}%`;
      }
  
      state[key] = value;
    }
  });

  const resultsFetched = []

  for (let i = 0; i < configs.size; i ++) {
    const urlObj = new URL(configs.url);
    const usp = urlObj.searchParams;
    usp.set('take', i);
    urlObj.search = usp.toString();

    queryParams.url = encodeURIComponent(urlObj.toString());
    const query = setUpQuery(queryParams);
  
    resultsFetched.push(fetchAndUpdateState(query, stateProxy));
    
    // throttle
    await forceWait(1000);
  }

  Promise.all(resultsFetched).then(async () => {
    const { default: calculateResult } = await import('./formulae.js');
    // wait for transition
    await forceWait(500);
    const payload = {
      targetSize: state.targetSize,
      strategy: configs.strategy,
      formula: configs.formula,
    };

    calculateResult(state, payload);
    showResult(payload);
  })
}

async function initSamplerForm() {
  const tabsObject = await chrome.tabs.query({ active: true })
  const currentTabUrl = tabsObject[0].url;

  if (!currentTabUrl) {
    document.body.textContent = "I think I'm a little lost...";
    return;
  }

  const samplerForm = document.getElementById('sample-size-form');

  if (!samplerForm) return;
  
  const urlInput = samplerForm.querySelector('input#sample-url');
  const sizeInput = samplerForm.querySelector('input#sample-size');
  const strategyInput = samplerForm.querySelector('#sample-strategy');
  const formulaInput = samplerForm.querySelector('#sample-formula');

  urlInput.value = currentTabUrl;
  samplerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await launchSampler({
      url: urlInput.value,
      size: sizeInput.value,
      strategy: strategyInput.value,
      formula: formulaInput.value,
    });
  })
}

initSamplerForm();
