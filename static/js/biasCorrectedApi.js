import {membersToStats} from "./rfsZarrFetcher.js";

const endpoint = 'https://geoglows.ecmwf.int/api/v2'

const forecastCorrectedUrl = riverId => `${endpoint}/forecastensemble/${riverId}?format=json&bias_corrected=true`
const retroCorrectedUrl = riverId => `${endpoint}/retrospectivedaily/${riverId}?format=json&bias_corrected=true`

const fetchForecastCorrected = async ({riverId}) => {
  /* api returns object of structure:
  {
    river_id: riverId,
    datetime: [ISO date strings, ...],
    ensemble_01 to ensemble_51: [Number or "", ...],
    ensemble_01_original to ensemble_51_original: [Number or "", ...],
  }
  The entries in all ensemble_** arrays which have "" values need to be removed (same entries in all arrays) as well as the datetime entries of the same index/position
  Also transform the structure into something that looks like the arrays returned by the zarr fetchers:
  {
    datetime: [ISO date strings, ...],
    discharge: [[ensemble_01 array], [ensemble_02 array], ...]
    discharge_original: [[ensemble_01_original array], [ensemble_02_original array], ...]
  }
  */
  const response = await fetch(forecastCorrectedUrl(riverId))
  if (!response.ok) throw new Error(`Error fetching bias-corrected forecast data: ${response.statusText}`)
  const data = await response.json()

  // the expected data structure is described by dischargeObjectKeys and nullIndices
  const nEnsMembs = 51
  const dischargeObjectKeys = Array.from({length: nEnsMembs}, (_, i) => `ensemble_${String(i + 1).padStart(2, '0')}`)
  const nullIndices = data[dischargeObjectKeys[0]].map((val, idx) => val === "" ? idx : -1).filter(idx => idx !== -1)
  for (const key of dischargeObjectKeys) {
    if (!(key in data)) throw new Error(`Key '${key}' not found in forecast bias-corrected data.`)
  }

  const datetime = data.datetime.filter((_, idx) => !nullIndices.includes(idx)).map(d => new Date(d))
  const discharge = dischargeObjectKeys.map(key => data[key].filter((_, idx) => !nullIndices.includes(idx)))
  const discharge_original = dischargeObjectKeys.map(key => data[`${key}_original`].filter((_, idx) => !nullIndices.includes(idx)))
  const stats = membersToStats(discharge)
  const stats_original = membersToStats(discharge_original)

  return Promise.resolve({datetime, discharge, discharge_original, stats, stats_original})
}

const fetchRetroCorrected = async ({riverId}) => {
  /* api returns object of structure:
  {
    datetime: [ISO date strings, ...],
    `${riverId}`: [Number or "", ...],
    `${riverId}_original`: [Number or "", ...],
  }
  we need to rename the keys to 'discharge' and 'discharge_original'
  */
  const response = await fetch(retroCorrectedUrl(riverId))
  if (!response.ok) throw new Error(`Error fetching bias-corrected retrospective data: ${response.statusText}`)
  const data = await response.json()
  return Promise.resolve({
    datetime: data.datetime.map(d => new Date(d)),
    discharge: data[`${riverId}`],
    discharge_original: data[`${riverId}_original`],
  })
}

export {fetchForecastCorrected, fetchRetroCorrected}
