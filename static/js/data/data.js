import {checkRiverIdExists, fetchForecast, fetchRetro, fetchReturnPeriods} from "./rfsZarrFetcher.js";
import {fetchForecastCorrected, fetchRetroCorrected} from "./biasCorrectedApi.js";
import {cacheData, cacheKey, readCache} from "./cache.js";

const getAndCacheForecast = async ({riverId, date, corrected}) => {
  const key = cacheKey({riverId, type: 'forecast', corrected, date})
  const cachedData = await readCache(key)
  if (cachedData) return Promise.resolve(cachedData)
  const data = corrected ? await fetchForecastCorrected({riverId}) : await fetchForecast({riverId, date})
  await cacheData(data, key)
  return Promise.resolve(data)
}

const getAndCacheRetrospective = async ({riverId, corrected}) => {
  const key = cacheKey({riverId, type: 'retro', corrected})
  const cachedData = await readCache(key)
  if (cachedData) return Promise.resolve(cachedData)
  const data = corrected ? await fetchRetroCorrected({riverId}) : await fetchRetro({riverId, resolution: 'daily'})
  await cacheData(data, key)
  return Promise.resolve(data)
}

const getAndCacheReturnPeriods = async ({riverId, corrected}) => {
  const key = cacheKey({riverId, type: 'returnPeriods', corrected})
  const cachedData = await readCache(key)
  if (cachedData) return Promise.resolve(cachedData)
  const data = await fetchReturnPeriods({riverId, corrected})
  await cacheData(data, key)
  return data
}

const validateRiverNumber = ({riverId}) => {
  // a riverId should be a positive 9 digit integer greater than 110,000,000 and less than 999,999,999
  // it should be of type number only
  if (typeof riverId !== 'number' || !Number.isInteger(riverId)) {
    return false;
  }
  if (riverId < 110000000 || riverId > 999999999) {
    return false;
  }
  return checkRiverIdExists({riverId})
}

////////////////// Module Exports
export {
  getAndCacheForecast,
  getAndCacheRetrospective,
  getAndCacheReturnPeriods,
  validateRiverNumber
}
