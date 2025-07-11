import {useBiasCorrected} from "./settings.js";

const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'

const fetchForecastPromise = ({riverid, date}) => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${date}&bias_corrected=${useBiasCorrected()}`)
      .then(response => response.json())
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchForecastMembersPromise = ({riverid, date}) => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/forecastensemble/${riverid}/?format=json&date=${date}&bias_corrected=${useBiasCorrected()}`)
      .then(response => response.json())
      .then(response => {
        // remove ensemble_52, remove entries in arrays for datetime and members that are empty
        if (response.hasOwnProperty('ensemble_52')) delete response.ensemble_52;
        const memberKeys = Object.keys(response).filter(key => key.startsWith('ensemble_'))
        const goodIndexes = response.ensemble_01.reduce((acc, value, index) => {
          if (value !== "") acc.push(index)
          return acc
        }, [])
        return {
          datetime: response.datetime.filter((_, index) => goodIndexes.includes(index)),
          ...memberKeys.reduce((acc, key) => {
            acc[key] = response[key].filter((_, index) => goodIndexes.includes(index))
            return acc
          }, {})
        }
      })
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchReturnPeriodsPromise = riverid => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/returnperiods/${riverid}/?format=json&bias_corrected=${useBiasCorrected()}`)
      .then(response => response.json())
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchRetroPromise = riverid => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/retrospective/${riverid}/?format=json&bias_corrected=${useBiasCorrected()}`)
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

export {fetchForecastPromise, fetchForecastMembersPromise, fetchReturnPeriodsPromise, fetchRetroPromise, updateDownloadLinks}