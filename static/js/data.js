import {LoadStatus, RiverId, UseBiasCorrected, UseSimpleForecast} from "./states/state.js"
import {clearCharts, plotAllForecast, plotAllRetro} from "./plots.js"
import {inputForecastDate, downloadForecastButton, downloadRetroButton, divModalCharts} from "./ui.js"
import {fetchForecast, fetchRetro, fetchReturnPeriods} from "./rfsZarrFetcher.js";
import {fetchForecastCorrected, fetchRetroCorrected} from "./biasCorrectedApi.js";
import {cacheData, cacheKey, clearCache, readCache} from "./cache.js";


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

const getAndCacheReturnPeriods = async riverId => {
  const corrected = UseBiasCorrected.get()
  const key = cacheKey({riverId, type: 'returnPeriods', corrected})
  const cachedData = await readCache(key)
  if (cachedData) return Promise.resolve(cachedData)
  const data = await fetchReturnPeriods({riverId, corrected})
  await cacheData(data, key)
  return data
}

const getForecastData = riverId => {
  riverId = riverId || RiverId.get()
  if (!riverId) return
  clearCharts('forecast')
  LoadStatus.update({forecast: "load"})
  const date = inputForecastDate.value.replaceAll("-", "")
  const corrected = UseBiasCorrected.get()
  const stats = UseSimpleForecast.get()
  Promise
    .all([getAndCacheForecast({riverId, date, corrected}), getAndCacheReturnPeriods(riverId)])
    .then(responses => {
      plotAllForecast({forecast: responses[0], rp: responses[1], riverId, corrected, showStats: stats})
      LoadStatus.update({forecast: "ready"})
      updateDownloadLinks({forecast: responses[0], riverId})
    })
    .catch(error => {
      console.error(error)
      LoadStatus.update({forecast: "fail"})
      clearCharts('forecast')
    })
}
const getRetrospectiveData = riverId => {
  riverId = riverId || RiverId.get()
  if (!riverId) return
  clearCharts('retro')
  LoadStatus.update({retro: "load"})
  const corrected = UseBiasCorrected.get()
  getAndCacheRetrospective({riverId, corrected})
    .then(response => {
      plotAllRetro({retro: response, riverId})
      LoadStatus.update({retro: "ready"})
      updateDownloadLinks({retro: response, riverId})
    })
    .catch(error => {
      console.error(error)
      LoadStatus.update({retro: "fail"})
      clearCharts('retro')
    })
}
const fetchData = ({riverId, display = true} = {}) => {
  if (display) M.Modal.getInstance(divModalCharts).open()
  getForecastData(riverId)
  getRetrospectiveData(riverId)
}

const addCsvDownloadToButton = (button, csvString, filename) => {
  button.disabled = false;
  button.onclick = async () => {
    // Prefer native save dialog if supported (Chrome/Edge, not Safari/Firefox)
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{description: 'CSV', accept: {'text/csv': ['.csv']}}],
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([csvString], {type: 'text/csv'}));
        await writable.close();
        return;
      } catch (err) {
        // If user cancels, just stop; otherwise fall back
        if (err?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed, falling back to anchor download', err);
      }
    }

    // Fallback that avoids opening a new tab
    const blob = new Blob([csvString], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.target = '_blank';
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
};

const updateDownloadLinks = ({forecast = null, retro = null, riverId = null, clear = false}) => {
  if (clear) {
    downloadForecastButton.disabled = true
    downloadRetroButton.disabled = true
    downloadForecastButton.onclick = null
    downloadRetroButton.onclick = null
    downloadForecastButton.href = ''
    downloadRetroButton.href = ''
    return
  }
  if (forecast) {
    const memberHeaders = forecast.discharge.map((_, index) => `member${index + 1}`).join(",")
    const statsHeaders = Object.keys(forecast.stats).map(stat => stat.charAt(0).toUpperCase() + stat.slice(1)).join(",")
    const csvHeaders = `Date,${memberHeaders},${statsHeaders}`
    const csvContent = forecast.datetime.map((time, index) => {
      const memberValues = forecast.discharge.map(memberArray => memberArray[index].toFixed(2)).join(",")
      const statsValues = Object.values(forecast.stats).map(statArray => statArray[index].toFixed(2)).join(",")
      return `${time.toISOString()},${memberValues},${statsValues}`
    }).join("\n")
    const csvString = csvHeaders + "\n" + csvContent
    addCsvDownloadToButton(downloadForecastButton, csvString, `forecast_${riverId}_${forecast.datetime[0].toISOString().slice(0, 10)}.csv`)
  }
  if (retro) {
    const csvHeaders = "Date,Discharge"
    const csvContent = retro.datetime.map((time, index) => {
      return `${time.toISOString()},${retro.discharge[index].toFixed(2)}`
    }).join("\n")
    const csvString = csvHeaders + "\n" + csvContent
    addCsvDownloadToButton(downloadRetroButton, csvString, `retrospective_${riverId}.csv`)
  }
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
  updateDownloadLinks,
  getRetrospectiveData,
  getForecastData,
  fetchData
}
