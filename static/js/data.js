import {RiverId, LoadStatus, useBiasCorrected, useForecastMembers} from "./states/state.js";
import {clearCharts, plotAllForecast, plotAllRetro} from "./plots.js";
import {inputForecastDate} from "./ui.js";

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

const getForecastData = riverid => {
  LoadStatus.update({forecast: "load"})
  const date = inputForecastDate.value.replaceAll("-", "")
  const showMembers = useForecastMembers()
  const forecastFetcher = showMembers ? fetchForecastMembersPromise : fetchForecastPromise
  Promise
    .all([forecastFetcher({riverid, date}), fetchReturnPeriodsPromise(riverid)])
    .then(responses => {
      plotAllForecast({forecast: responses[0], rp: responses[1], riverid: riverid, showMembers})
      LoadStatus.update({forecast: "ready"})
    })
    .catch(() => {
      LoadStatus.update({forecast: "fail"})
      clearCharts('forecast')
    })
}
const getRetrospectiveData = () => {
  if (!RiverId.get()) return
  LoadStatus.update({retro: "load"})
  fetchRetroPromise(RiverId.get())
    .then(response => {
      plotAllRetro({retro: response, riverid: RiverId.get()})
      LoadStatus.update({retro: "ready"})
    })
    .catch(() => {
      LoadStatus.update({retro: "fail"})
      clearCharts('retro')
    })
}
const fetchData = riverid => {
  if (!riverid) return
  getForecastData(riverid)
  getRetrospectiveData()
  M.Modal.getInstance(document.getElementById('charts-modal')).open()
}

const updateDownloadLinks = riverid => {
  const hrefForecast = riverid ? `${REST_ENDPOINT}/forecast/${riverid}` : ""
  const hrefRetro = riverid ? `${REST_ENDPOINT}/retrospective/${riverid}` : ""
  document.getElementById("download-forecast-link").href = hrefForecast
  document.getElementById("download-retrospective-link").href = hrefRetro
  document.getElementById("download-forecast-btn").disabled = !riverid
  document.getElementById("download-retrospective-btn").disabled = !riverid
}

export {
  fetchForecastPromise,
  fetchForecastMembersPromise,
  fetchReturnPeriodsPromise,
  fetchRetroPromise,
  updateDownloadLinks,
  getRetrospectiveData,
  getForecastData,
  fetchData
}
