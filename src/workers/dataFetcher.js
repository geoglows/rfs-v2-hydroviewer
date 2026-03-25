// Defines a web worker that listens for a message object with riverId and array of datasets to fetch
// Uses functions from main.js to fetch and cache the specified datasets for the given riverId
// Sends messages to the main thread indicating start and finish progress for progress indicators

import {getAndCacheForecast, getAndCacheRetrospective, getAndCacheReturnPeriods} from '../data/main.js';

self.onmessage = async function (event) {
  const {riverId, forecastDate, datasetList = []} = event.data;
  let errors = [];
  let forecast = null;
  let returnPeriods = null;
  let retrospective = null;

  try {
    forecast = await getAndCacheForecast({riverId: riverId, date: forecastDate, biasCorrected: false});
    returnPeriods = await getAndCacheReturnPeriods({riverId: riverId, biasCorrected: false});

    if (datasetList.includes('retrospective')) {
    retrospective = await getAndCacheRetrospective({riverId, corrected: false})
    }
  } catch (error) {
    errors.push({riverId, error: error.message});
  }

  // Notify that fetching has finished
  if (errors.length > 0) {
    self.postMessage({riverId, status: 'error', errors});
    return;
  }
  self.postMessage({riverId, status: 'finished', forecast, returnPeriods, retrospective});
};
