import {LoadStatus, RiverId, UseBiasCorrected, useForecastMembers} from "./states/state.js"
import {clearCharts, plotAllForecast, plotAllRetro} from "./plots.js"
import {inputForecastDate} from "./ui.js"

const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'

const CACHE_SIZE = 125
const DB_NAME = 'RiverCacheDB'
const STORE_NAME = 'cache'

const cacheKey = ({riverid, biasCorrected, type, date}) => `${riverid}-${biasCorrected}-${type}-${date}`
const openCacheDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = event => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {keyPath: 'key'})
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
const pruneCacheIfNeeded = async db => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const req = store.getAll()

    req.onsuccess = function () {
      const items = req.result
      if (items.length > CACHE_SIZE) {
        items.sort((a, b) => a.timestamp - b.timestamp)
        const toRemove = items.length - CACHE_SIZE
        for (let i = 0; i < toRemove; i++) {
          store.delete(items[i].key)
        }
      }
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}
const dataIsCached = async key => {
  const db = await openCacheDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(!!req.result)
    req.onerror = () => reject(req.error)
  })
}
const getCachedData = async key => {
  const db = await openCacheDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result ? req.result.data : undefined)
    req.onerror = () => reject(req.error)
  })
}
const cacheData = async (data, key) => {
  const db = await openCacheDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  store.put({key, data, timestamp: Date.now()})
  tx.oncomplete = () => pruneCacheIfNeeded(db)
  tx.onerror = () => {
  }
}
const clearCache = async () => {
  const db = await openCacheDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  store.clear()
}

const fetchForecastPromise = async ({riverid, date}) => {
  const biasCorrected = UseBiasCorrected.get()
  let key = cacheKey({riverid, biasCorrected, type: 'forecast', date: date})
  if (await dataIsCached(key)) return getCachedData(key)
  return fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${date}&bias_corrected=${biasCorrected}`)
    .then(response => response.json())
    .then(response => {
      cacheData(response, key)
      return response
    })
}
const fetchForecastMembersPromise = async ({riverid, date}) => {
  const biasCorrected = UseBiasCorrected.get()
  let key = cacheKey({riverid, biasCorrected, type: 'forecastMembers', date})
  if (await dataIsCached(key)) return getCachedData(key)
  return fetch(`${REST_ENDPOINT}/forecastensemble/${riverid}/?format=json&date=${date}&bias_corrected=${biasCorrected}`)
    .then(response => response.json())
    .then(response => {
      if (response.hasOwnProperty('ensemble_52')) delete response.ensemble_52
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
      cacheData(response, key)
      return response
    })
}
const fetchReturnPeriodsPromise = async riverid => {
  const biasCorrected = UseBiasCorrected.get()
  const key = cacheKey({riverid, biasCorrected, type: 'returnPeriods', date: 'static'})
  if (await dataIsCached(key)) return getCachedData(key)
  return fetch(`${REST_ENDPOINT}/returnperiods/${riverid}/?format=json&bias_corrected=${biasCorrected}`)
    .then(response => response.json())
    .then(response => {
      cacheData(response, key)
      return response
    })
}
const fetchRetroPromise = async riverid => {
  const biasCorrected = UseBiasCorrected.get()
  const key = cacheKey({riverid, biasCorrected, type: 'retro', date: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10).replaceAll('-', '')})
  if (await dataIsCached(key)) return getCachedData(key)
  return fetch(`${REST_ENDPOINT}/retrospective/${riverid}/?format=json&bias_corrected=${biasCorrected}`)
    .then(response => response.json())
    .then(response => {
      cacheData(response, key)
      return response
    })
}

const getForecastData = riverid => {
  riverid = riverid || RiverId.get()
  if (!riverid) return
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
    .catch(error => {
      console.error(error)
      LoadStatus.update({forecast: "fail"})
      clearCharts('forecast')
    })
}
const getRetrospectiveData = riverid => {
  riverid = riverid || RiverId.get()
  if (!riverid) return
  LoadStatus.update({retro: "load"})
  fetchRetroPromise(RiverId.get())
    .then(response => {
      plotAllRetro({retro: response, riverid: RiverId.get()})
      LoadStatus.update({retro: "ready"})
    })
    .catch(error => {
      console.error(error)
      LoadStatus.update({retro: "fail"})
      clearCharts('retro')
    })
}
const fetchData = ({riverid, display = true} = {}) => {
  getForecastData(riverid)
  getRetrospectiveData(riverid)
  if (display) {
    M.Modal.getInstance(document.getElementById('charts-modal')).open()
  }
}

const updateDownloadLinks = riverid => {
  const hrefForecast = riverid ? `${REST_ENDPOINT}/forecast/${riverid}` : ""
  const hrefRetro = riverid ? `${REST_ENDPOINT}/retrospective/${riverid}` : ""
  document.getElementById("download-forecast-link").href = hrefForecast
  document.getElementById("download-retrospective-link").href = hrefRetro
}

////////////////// Event Listeners
const clearCacheButtons = Array.from(document.getElementsByClassName("clear-cache"))
clearCacheButtons.forEach(btn => {
  btn.onclick = () => {
    if (confirm('Are you sure you want to clear downloaded data?')) {
      clearCache().then(() => alert('Cache cleared!'))
    }
  }
})

////////////////// Module Exports
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
