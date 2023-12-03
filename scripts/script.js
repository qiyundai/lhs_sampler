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

async function fetchScore(query) {
  return await fetch(query).then(response => response.json());
}

function showResult(resultPackage) {
  const { score, strategy } = resultPackage;

  togglePages('#loading-page', '#result-page');

  const resultPage = document.getElementById('result-page');
  
  const strategyPH = resultPage.querySelector('#strategy-placeholder');
  const scorePH = resultPage.querySelector('#average-performance-score');

  strategyPH.textContent = strategy;
  scorePH.textContent = score;
}

function forceWait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  })
}

async function launchSampler(configs) {
  let aggregatedPerformanceScore = 0;

  const loadingPage = document.getElementById('loading-page');
  const progressBarFill = loadingPage.querySelector('#progress-bar-fill')

  togglePages('#input-page', '#loading-page');

  const queryParams = {
    strategy: configs.strategy,
    category: 'PERFORMANCE',
  }

  for (let i = 0; i < configs.size; i ++) {
    const urlObj = new URL(configs.url);
    const usp = urlObj.searchParams;
    usp.set('take', i);
    urlObj.search = usp.toString();

    queryParams.url = encodeURIComponent(urlObj.toString());
    const query = setUpQuery(queryParams);
  
    const resultJson = await fetchScore(query);
    const performanceScore = resultJson.lighthouseResult.categories.performance.score * 100;

    console.log(`take ${i + 1}: ${performanceScore}`);

    aggregatedPerformanceScore += performanceScore;
    progressBarFill.style.maxWidth = `${((i + 1) / configs.size) * 100}%`;
    
    if (i === configs.size - 1) {
      // to let the progress bar finis its animation
      await forceWait(400);
    }
  }

  const resultPackage = {
    score: aggregatedPerformanceScore / configs.size,
    strategy: configs.strategy,
  }

  showResult(resultPackage);
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
