function setUpQuery(params) {
  const api = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
  let query = `${api}?`;
  for (key in params) {
    query += `${key}=${parameters[key]}`;
  }
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

async function launchSampler(configs) {
  const tabsObject = await chrome.tabs.query({active: true})
  const currentTabUrl = tabsObject[0].url;

  if (!currentTabUrl) return;

  const loadingPage = document.querySelector('#loading-page');
  const progressBarFill = loadingPage.querySelector('#progress-bar-fill')

  togglePages('#input-page', '#loading-page');

  const query = setUpQuery({
    url: encodeURIComponent(currentTabUrl),
    strategy: configs.strategy,
    category: 'PERFORMANCE',
  });

  const resultJson = await fetchScore(query);

  console.log(resultJson);

  progressBarFill.textContent = resultJson;
}

function initSamplerForm() {
  const samplerForm = document.querySelector('form#sample-size-form');

  if (samplerForm) {
    const input = samplerForm.querySelector('input#sample-size');
    const button = samplerForm.querySelector('button');

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      await launchSampler({
        size: input.value,
      });
    })
  }
}

initSamplerForm();
