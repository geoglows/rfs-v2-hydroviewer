import {_fetchDischarge, _fetchForecastDischarge, _fetchReturnPeriods, fetchCoordinateVariable, fetchTimeCoordinate} from "./zarrUtilities.js";
import {readStore, riversDbStoreName, saveStore} from "./cache.js";

const baseRetroZarrUrl = "https://d2grb3c773p1iz.cloudfront.net" // "http://geoglows-v2.s3-us-west-2.amazonaws.com"
const baseForecastZarrUrl = "https://d14ritg1bypdp7.cloudfront.net"  // "http://geoglows-v2-forecasts.s3-website-us-west-2.amazonaws.com"
const retrospectiveZarrUrl = `${baseRetroZarrUrl}/retrospective/daily.zarr`;

const endpoint = 'https://geoglows.ecmwf.int/api/v2'
const forecastCorrectedUrl = ({riverId, date}) => `${endpoint}/forecastensemble/${riverId}?format=json&date=${date}&bias_corrected=true`
const retroCorrectedUrl = riverId => `${endpoint}/retrospectivedaily/${riverId}?format=json&bias_corrected=true`

const _membersToStats = membersArray => {
  // takes an array of equally sized subarrays (one for each member) and computes timestep-wise statistics
  const nMembers = membersArray.length
  const nTimesteps = membersArray[0].length
  let stats = {
    min: Array(nTimesteps).fill(0),
    p20: Array(nTimesteps).fill(0),
    p25: Array(nTimesteps).fill(0),
    median: Array(nTimesteps).fill(0),
    p75: Array(nTimesteps).fill(0),
    p80: Array(nTimesteps).fill(0),
    max: Array(nTimesteps).fill(0),
    average: Array(nTimesteps).fill(0),
  }
  Array(nTimesteps).fill(0).forEach((_, idx) => {
    const timestepValues = membersArray.map(member => member[idx]).sort((a, b) => a - b)
    stats.min[idx] = timestepValues[0]
    stats.p20[idx] = timestepValues[Math.floor(0.20 * nMembers)]
    stats.p25[idx] = timestepValues[Math.floor(0.25 * nMembers)]
    stats.median[idx] = timestepValues[Math.floor(0.5 * nMembers)]
    stats.p75[idx] = timestepValues[Math.floor(0.75 * nMembers)]
    stats.p80[idx] = timestepValues[Math.floor(0.80 * nMembers)]
    stats.max[idx] = timestepValues[nMembers - 1]
    stats.average[idx] = timestepValues.reduce((a, b) => a + b, 0) / nMembers
  })
  return stats
}

const getRiverIdsWithCache = async () => {
  const key = 'riverIds'
  const cachedData = await readStore({storeName: riversDbStoreName, key})
  if (cachedData) {
    return Promise.resolve(cachedData)
  } else {
    const riverIds = await fetchCoordinateVariable({zarrUrl: retrospectiveZarrUrl, varName: 'river_id'});
    await saveStore({storeName: riversDbStoreName, key, data: riverIds.data})
    return Promise.resolve(riverIds.data)
  }
}

const fetchForecast = async ({riverId, date}) => {
  /*
  Retrieves 51 member ensemble forecast discharge for a given riverId and initialization date (YYYYMMDD). The returns an object of structure:
  {
    datetime: [Date, Date, ...],
    discharge: [
      [Number, Number, ...],
      [Number, Number, ...],
      ...
    ], // array of arrays, one per ensemble member (51 total)
    stats: {
      min: [Number, Number, ...],
      p20: [Number, Number, ...],
      ... // etc, see _membersToStats function
    }
  }
  */
  if (!/^\d{8}$/.test(date)) return Promise.reject(new Error(`Date '${date}' is not in the correct format YYYYMMDD.`));

  // get data from zarr
  const zarrUrl = `${baseForecastZarrUrl}/${date}00.zarr`;
  const riverIds = await getRiverIdsWithCache();
  const idx = riverIds.indexOf(riverId);
  if (idx === -1) return Promise.reject(new Error(`River ID ${riverId} not found.`));
  const nEnsMems = 51;
  let [datetime, discharge] = await Promise.all([fetchTimeCoordinate(zarrUrl), _fetchForecastDischarge({zarrUrl, idx, varName: 'Qout'})])
  // discharge has shape of [nEnsMems, datetime.length] but it's flattened. find out which discharges are nan in the first ensemble member for reference in filtering the rest
  const validTimeIndices = discharge.slice(0, datetime.length).map((val, i) => !isNaN(val) ? i : -1).filter(i => i !== -1);
  // split the discharge array into the correct number of subarrays
  const memberStartIndices = Array(nEnsMems).fill(0).map((_, i) => i * datetime.length);
  discharge = memberStartIndices
    .map(startIdx => discharge.slice(startIdx, startIdx + datetime.length))  // array of nEnsMems subarrays
    .map(memberArray => validTimeIndices.map(i => memberArray[i]))  // for each member array, select only the valid time indices
  datetime = validTimeIndices.map(i => datetime[i]);
  const stats = _membersToStats(discharge);
  return Promise.resolve({datetime, discharge, stats});
}
const fetchRetro = async ({riverId, resolution = "daily"}) => {
  /*
  Retrieve retrospective simulations for a given river Id and time step/resolution. Returns an object of structure:
  {
    datetime: [Date, Date, ...],
    discharge: [Number, Number, ...],
  }
  */
  const recognizedResolutions = ['hourly', 'daily', 'monthly', 'yearly', 'maximums'];
  if (!recognizedResolutions.includes(resolution)) return Promise.reject(new Error(`Resolution '${resolution}' is not recognized.`));

  // get data from zarr
  const zarrUrl = `${baseRetroZarrUrl}/retrospective/${resolution}.zarr`;
  const riverIds = await getRiverIdsWithCache();
  const idx = riverIds.indexOf(riverId);
  if (idx === -1) return Promise.reject(new Error(`River ID ${riverId} not found.`));
  const [datetime, discharge] = await Promise.all([fetchTimeCoordinate(zarrUrl), _fetchDischarge({zarrUrl, idx, varName: 'Q'})])

  return Promise.resolve({datetime, discharge});
}
const fetchReturnPeriods = async ({riverId}) => {
  /*
  Returns an object with key values of return period estimates in years (type Number) to values of discharge in m3/s (type Number), e.g.:
  {
    2: discharge for 2-year return period,
    5: discharge for 5-year return period,
    10: discharge for 10-year return period,
    ...
  }
  */
  const zarrUrl = `${baseRetroZarrUrl}/retrospective/return-periods.zarr`;
  const riverIds = await getRiverIdsWithCache();
  const idx = riverIds.indexOf(riverId);
  if (idx === -1) return Promise.reject(new Error(`River ID ${riverId} not found.`));

  let returnPeriodLabels = await fetchCoordinateVariable({zarrUrl, varName: 'return_period'})
  returnPeriodLabels = [...returnPeriodLabels.data]
  const returnPeriods = await _fetchReturnPeriods({zarrUrl, idx})

  // make an object mapping return period labels to their corresponding discharge values
  const rpData = {}
  returnPeriodLabels.forEach((label, i) => rpData[Number(label)] = Number(returnPeriods[i]))
  return Promise.resolve(rpData);
}

const fetchForecastCorrected = async ({riverId, date}) => {
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
  const response = await fetch(forecastCorrectedUrl({riverId, date}))
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
  const stats = _membersToStats(discharge)
  const stats_original = _membersToStats(discharge_original)

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

export {
  fetchForecast,
  fetchRetro,
  fetchReturnPeriods,
  fetchForecastCorrected,
  fetchRetroCorrected,

  getRiverIdsWithCache,

  retrospectiveZarrUrl
}
