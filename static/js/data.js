import {LoadStatus, RiverId, useBiasCorrected, useForecastMembers} from "./states/state.js";
import {clearCharts, plotAllForecast, plotAllRetro} from "./plots.js";
import {inputForecastDate} from "./ui.js";

const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'

const CACHE_SIZE = 50;
const dataCache = new Map();

const cacheKey = ({riverid, type, forecastDate}) => `${riverid}-${type}-${forecastDate || 'none'}`
const dataIsCached = key => dataCache.has(key)
const getCachedData = key => dataCache.get(key)
const cacheData = ({data, riverid, type, forecastDate}) => {
  const key = cacheKey({riverid, type, forecastDate});

  if (dataCache.has(key)) dataCache.delete(key)  // allows the item to be moved to the end of the delete order
  dataCache.set(key, data);

  if (dataCache.size > CACHE_SIZE) {
    const oldestKey = dataCache.keys().next().value;
    dataCache.delete(oldestKey);
  }
}

const fetchForecastPromise = ({riverid, date}) => {
  let key = cacheKey({riverid, type: 'forecast', forecastDate: date})
  if (dataIsCached(key)) return Promise.resolve(getCachedData(key))
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${date}&bias_corrected=${useBiasCorrected()}`)
      .then(response => response.json())
      .then(response => {
        cacheData({data: response, riverid, type: 'forecast', forecastDate: date})
        return response
      })
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchForecastMembersPromise = ({riverid, date}) => {
  let key = cacheKey({riverid, type: 'forecastMembers', forecastDate: date})
  if (dataIsCached(key)) return Promise.resolve(getCachedData(key))
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
      .then(response => {
        cacheData({data: response, riverid, type: 'forecastMembers', forecastDate: date})
        return response
      })
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchReturnPeriodsPromise = riverid => {
  const key = cacheKey({riverid, type: 'returnPeriods'})
  if (dataIsCached(key)) return Promise.resolve(getCachedData(key))
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/returnperiods/${riverid}/?format=json&bias_corrected=${useBiasCorrected()}`)
      .then(response => response.json())
      .then(response => {
        cacheData({data: response, riverid, type: 'returnPeriods'})
        return response
      })
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchRetroPromise = riverid => {
  const key = cacheKey({riverid, type: 'retro'})
  if (dataIsCached(key)) return Promise.resolve(getCachedData(key))
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/retrospective/${riverid}/?format=json&bias_corrected=${useBiasCorrected()}`)
      .then(response => response.json())
      .then(response => {
        cacheData({data: response, riverid, type: 'retro'})
        return response
      })
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
