function setUpQuery(params) {
  let query = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed?';

  Object.entries(params).forEach((entry, index) => {
    query += `${index > 0 ? '&' : ''}${entry[0]}=${entry[1]}`;
  })

  return query;
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
      state.perfScore += json.lighthouseResult.categories.performance.score * 100;
      state.clsVal += json.lighthouseResult.audits["cumulative-layout-shift"].numericValue * 100;
      state.clsScore += json.lighthouseResult.audits["cumulative-layout-shift"].score * 100;
      state.lcpVal += json.lighthouseResult.audits["largest-contentful-paint"].numericValue;
      state.lcpScore += json.lighthouseResult.audits["largest-contentful-paint"].score * 100;
      state.tbtVal += json.lighthouseResult.audits["total-blocking-time"].numericValue;
      state.tbtScore += json.lighthouseResult.audits["total-blocking-time"].score * 100;
      state.siVal += json.lighthouseResult.audits["speed-index"].numericValue;
      state.siScore += json.lighthouseResult.audits["speed-index"].score * 100;
      resolve();
    });
  })
}

function showResult(resultPackage) {
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
  } = resultPackage;
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
    perfScore: 0,
    clsVal: 0,
    clsScore: 0,
    lcpVal: 0,
    lcpScore: 0,
    tbtVal: 0,
    tbtScore: 0,
    siVal: 0,
    siScore: 0,
    fetchCounter: 0,
    targetSize: configs.size,
  }

  const stateProxy = new Proxy(state, {
    set: (state, key, value) => {
      const progressBarFill = document.getElementById('progress-bar-fill');
  
      if (progressBarFill) {
        progressBarFill.style.maxWidth = `${((state.currentIndex + 1) / state.targetSize) * 100}%`;
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

    state.currentIndex = i;
    queryParams.url = encodeURIComponent(urlObj.toString());
    const query = setUpQuery(queryParams);
  
    resultsFetched.push(fetchAndUpdateState(query, stateProxy));
    
    await forceWait(500);
  }

  Promise.all(resultsFetched).then(() => {
    const resultPackage = {
      targetSize: state.targetSize,
      perfScore: state.perfScore / configs.size,
      clsVal: state.clsVal / configs.size,
      clsScore: state.clsScore / configs.size,
      lcpVal: state.lcpVal / configs.size,
      lcpScore: state.lcpScore / configs.size,
      tbtVal: state.tbtVal / configs.size,
      tbtScore: state.tbtScore / configs.size,
      siVal: state.siVal / configs.size,
      siScore: state.siScore / configs.size,
      fetchCounter: state.fetchCounter / configs.size,
      strategy: configs.strategy,
    }
  
    showResult(resultPackage);
  })
}

async function initSamplerForm() {
  const tabsObject = await chrome.tabs.query({active: true})
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

  urlInput.value = currentTabUrl;
  samplerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await launchSampler({
      url: urlInput.value,
      size: sizeInput.value,
      strategy: strategyInput.value,
    });
  })
}

initSamplerForm();
