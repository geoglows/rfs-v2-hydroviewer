// Defines a web worker that listens for a message object with riverId and array of datasets to fetch
// Uses functions from data.js to fetch and cache the specified datasets for the given riverId
// Sends messages to the main thread indicating start and finish progress for progress indicators

import {getAndCacheForecast, getAndCacheRetrospective, getAndCacheReturnPeriods} from '../data/data.js';

self.onmessage = async function (event) {
  const {riverId, forecastDate, datasetList} = event.data;
  console.log(`Worker: Fetching data for river ID ${riverId} for datasets: ${datasetList.join(', ')}`);

  // Notify that fetching has started
  self.postMessage({riverId, status: 'started'});
  let errors = []
  let forecast = null;
  let returnPeriods = null;

  try {
    forecast = await getAndCacheForecast({riverId: riverId, date: forecastDate, biasCorrected: false});
    returnPeriods = await getAndCacheReturnPeriods({riverId: riverId, biasCorrected: false});
  } catch (error) {
    errors.push({riverId, error: error.message});
  }

  // Notify that fetching has finished
  if (errors.length > 0) {
    self.postMessage({riverId, status: 'error', errors});
    return;
  }
  self.postMessage({riverId, status: 'finished', forecast, returnPeriods});
};
