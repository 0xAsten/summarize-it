document.addEventListener('DOMContentLoaded', async function () {
  loadMain()

  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  })
  const response = await chrome.tabs.sendMessage(tab.id, {
    action: 'summarize-selection',
  })
  const content = response.content
  console.log('content:' + content)

  if (!content || content.trim().length === 0) {
    document.getElementById('main-page').classList.remove('hidden')
    loadMainPage()
  } else {
    document.getElementById('side-page').innerHTML = 'processing...'
    document.getElementById('side-page').classList.remove('hidden')
    requestGPTAPI(content.trim(), 1).then((summary) => {
      document.getElementById('side-page').innerHTML = summary
    })
  }
})

function loadMain() {
  var editIcon = document.getElementById('editIcon')
  var saveIcon = document.getElementById('saveIcon')
  editIcon.addEventListener('click', function () {
    editIcon.parentElement.classList.add('hidden')
    saveIcon.parentElement.classList.remove('hidden')
  })
  saveIcon.addEventListener('click', function () {
    storeApiKey()
    saveIcon.parentElement.classList.add('hidden')
    editIcon.parentElement.classList.remove('hidden')
  })

  // get user's api key from storage and render it to the apiKeyStored span
  chrome.storage.sync.get(['apiKey'], function (result) {
    const apiKey = result.apiKey
    if (!apiKey) {
      editIcon.parentElement.classList.add('hidden')
      saveIcon.parentElement.classList.remove('hidden')
    } else {
      document.getElementById('apiKeyStored').textContent =
        retainThreeCharacters(apiKey)
    }
  })

  const summarizeButton = document.getElementById('summarize-button')
  const summarizeThisPageButton = document.getElementById(
    'summarize-this-page-button'
  )
  const languageSelect = document.getElementById('languages')
  languageSelect.addEventListener('change', function () {
    chrome.storage.sync.set({ language: languageSelect.value }, function () {
      summarizeButton.innerText = 'Summarize In ' + languageSelect.value
      summarizeThisPageButton.innerText =
        'Summarize This Page In ' + languageSelect.value
    })
  })

  chrome.storage.sync.get(['language'], function (result) {
    let language = result.language
    if (!language) language = 'English'

    languageSelect.value = language
    summarizeButton.innerText = 'Summarize In ' + language
    summarizeThisPageButton.innerText = 'Summarize This Page In ' + language
  })
}

function loadMainPage() {
  const summarizeThisPageButton = document.getElementById(
    'summarize-this-page-button'
  )
  summarizeThisPageButton.addEventListener('click', function () {
    summarizeThisPageButton.disabled = true
    document.getElementById('summary').innerHTML = 'processing...'
    sendMessage().then((summary) => {
      summarizeThisPageButton.disabled = false
      document.getElementById('summary').innerHTML = summary
    })
  })

  const summarizeButton = document.getElementById('summarize-button')
  summarizeButton.addEventListener('click', function () {
    let words = document.getElementById('wordInput').value
    summarizeButton.disabled = true
    document.getElementById('summary').innerHTML = 'processing...'

    requestGPTAPI(words.trim(), 1).then((summary) => {
      summarizeButton.disabled = false
      document.getElementById('summary').innerHTML = summary
    })
  })
}

const sendMessage = async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    })
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'summarize',
    })
    const content = response.content

    let summary = ''
    let flag = true

    // if words is empty, return
    if (!content.length || !content.trim().length) {
      flag = false
      summary = 'Web page content is empty'
    }

    if (flag) summary = await requestGPTAPI(content.trim(), 1)

    return summary
  } catch (error) {
    return error.message + ' Refresh the page and try again'
  }
}

// a function to request GPT API and get the repsonse
async function requestGPTAPI(content, completions) {
  const apiKey = await readSyncStorage('apiKey')

  // is apiKey is empty, return
  if (!apiKey || !apiKey.trim().length) {
    return `Please enter your API key in the designated field. You can get your API key from https://openai.com/`
  }

  if (!content || !content.trim().length) {
    return 'text is empty'
  }

  // remove all the new line characters
  content = content
    .replace(/(\r\n|\n|\r)/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const language = document.getElementById('languages').value
  const promptTemplate = `Please briefly summarize the following in ${language}:`
  const prompt = `${promptTemplate}\n${content}`
  console.log('prompt: ' + prompt)
  const url = 'https://api.openai.com/v1/completions'
  const data = {
    // model: 'text-curie-001',
    model: 'text-davinci-003',
    prompt: prompt,
    max_tokens: 1000,
    temperature: 0.8,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    n: completions,
  }
  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
  }
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(data),
    })

    const res = await response.json()
    if (response.status !== 200) {
      throw new Error(res.error.message)
    }

    return res.choices[0].text
  } catch (error) {
    return `OpenAI API Error: ${error.message}`
  }
}

// a function to retains api key three characters before and after
function retainThreeCharacters(apiKey) {
  const length = apiKey.length
  const firstThree = apiKey.slice(0, 3)
  const lastThree = apiKey.slice(length - 3, length)
  return `${firstThree}...${lastThree}`
}

// a function to store user's api key
function storeApiKey() {
  const apiKey = document.getElementById('apiKey').value

  if (apiKey.length) {
    chrome.storage.sync.set({ apiKey }, function () {
      document.getElementById(
        'apiKeyStored'
      ).innerHTML = `<span>${retainThreeCharacters(apiKey)}</span>`
    })
  }
}

// const readSyncStorage = async (key) => {
//   return new Promise((resolve, reject) => {
//     chrome.storage.sync.get([key], function (result) {
//       if (result[key] === undefined) {
//         reject()
//       } else {
//         resolve(result[key])
//       }
//     })
//   })
// }

const readSyncStorage = async (key) => {
  return new Promise((resolve, reject) => {
    chrome.storage.sync
      .get([key])
      .then((result) => {
        resolve(result[key])
      })
      .catch((error) => {
        reject(error)
      })
  })
}
