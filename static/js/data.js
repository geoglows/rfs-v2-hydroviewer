const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'

const useBC = () => document.getElementById('useBC').checked

const fetchForecastPromise = ({riverid, date}) => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${date}&bias_corrected=${useBC()}`)
      .then(response => response.json())
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchReturnPeriodsPromise = riverid => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/returnperiods/${riverid}/?format=json&bias_corrected=${useBC()}`)
      .then(response => response.json())
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchRetroPromise = riverid => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/retrospective/${riverid}/?format=json&bias_corrected=${useBC()}`)
      .then(response => response.json())
      .then(response => resolve(response))
      .catch(() => reject())
  })
}

const updateDownloadLinks = riverid => {
  const hrefForecast = riverid ? `${REST_ENDPOINT}/forecast/${riverid}` : ""
  const hrefRetro = riverid ? `${REST_ENDPOINT}/retrospective/${riverid}` : ""
  document.getElementById("download-forecast-link").href = hrefForecast
  document.getElementById("download-retrospective-link").href = hrefRetro
  document.getElementById("download-forecast-btn").disabled = !riverid
  document.getElementById("download-retrospective-btn").disabled = !riverid
}

export {fetchForecastPromise, fetchReturnPeriodsPromise, fetchRetroPromise, updateDownloadLinks}