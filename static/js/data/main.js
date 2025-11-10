import {fetchForecast, fetchForecastCorrected, fetchRetro, fetchRetroCorrected, fetchReturnPeriods, getRiverIdsWithCache} from "./data.js";
import {cacheDbStoreName, cacheKey, readStore, saveStore} from "./cache.js";

const getAndCacheForecast = async ({riverId, date, corrected}) => {
  const key = cacheKey({riverId, type: 'forecast', corrected, date})
  const cachedData = await readStore({storeName: cacheDbStoreName, key})
  if (cachedData) return Promise.resolve(cachedData)
  const data = corrected ? await fetchForecastCorrected({riverId, date}) : await fetchForecast({riverId, date})
  await saveStore({storeName: cacheDbStoreName, key, data})
  return Promise.resolve(data)
}

const getAndCacheRetrospective = async ({riverId, corrected}) => {
  const key = cacheKey({riverId, type: 'retro', corrected})
  const cachedData = await readStore({storeName: cacheDbStoreName, key})
  if (cachedData) return Promise.resolve(cachedData)
  const data = corrected ? await fetchRetroCorrected({riverId}) : await fetchRetro({riverId, resolution: 'daily'})
  await saveStore({storeName: cacheDbStoreName, key, data})
  return Promise.resolve(data)
}

const getAndCacheReturnPeriods = async ({riverId, corrected}) => {
  const key = cacheKey({riverId, type: 'returnPeriods', corrected})
  const cachedData = await readStore({storeName: cacheDbStoreName, key})
  if (cachedData) return Promise.resolve(cachedData)
  const data = await fetchReturnPeriods({riverId, corrected})
  await saveStore({storeName: cacheDbStoreName, key, data})
  return data
}

const validateRiverNumber = async ({riverId}) => {
  const riverIds = await getRiverIdsWithCache()
  return riverIds.indexOf(riverId) !== -1
}

////////////////// Module Exports
export {
  getAndCacheForecast,
  getAndCacheRetrospective,
  getAndCacheReturnPeriods,
  validateRiverNumber
}
