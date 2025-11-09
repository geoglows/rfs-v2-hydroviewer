/// URLs
import {clearStore} from "./data/cache.js";

export const RFS_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'

//// DOM Elements
// buttons
const downloadForecastButton = document.getElementById("download-forecast-link")
const downloadRetroButton = document.getElementById("download-retrospective-link")
// filter inputs
export const selectRiverCountry = document.getElementById('riverCountry')
export const selectOutletCountry = document.getElementById('outletCountry')
export const selectVPU = document.getElementById('vpuSelect')
export const definitionString = document.getElementById("definitionString")
export const definitionDiv = document.getElementById("definition-expression")
export const inputForecastDate = document.getElementById('forecast-date-calendar')
// modals
export const divModalCharts = document.getElementById("charts-modal")
export const modalFilter = document.getElementById("filter-modal")
// charts
export const divSelectedRiverId = document.getElementById("selected-river-id")
export const riverIdInputContainer = document.getElementById('enter-river-id-container')
export const riverIdInput = document.getElementById("river-id")
export const divChartForecast = document.getElementById("forecastPlot")
export const divTableForecast = document.getElementById("forecastTable")
export const divChartRetro = document.getElementById("retroPlot")
export const divChartYearlyVol = document.getElementById("yearlyVolPlot")
export const divChartStatus = document.getElementById("yearlyStatusPlot")
export const divChartFdc = document.getElementById("fdcPlot")
export const divYearlyPeaks = document.getElementById("yearlyPeaksPlot")
export const divRasterHydrograph = document.getElementById("rasterHydrographPlot")
export const divCumulativeVolume = document.getElementById("cumVolume")

// Misc constants
export const lang = window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en-US'
const loadingImageTag = `<img src="/static/img/loading.io.svg" alt="loading">`

////////////////// Event Listeners
const clearCacheButtons = Array.from(document.getElementsByClassName("clear-cache"))
clearCacheButtons.forEach(btn => {
  btn.onclick = () => {
    if (confirm('Are you sure you want to clear downloaded data?')) {
      clearStore().then(() => alert('Cache cleared!'))
    }
  }
})

const clearCharts = chartTypes => {
  if (chartTypes === "forecast" || chartTypes === null || chartTypes === undefined) {
    [divChartForecast, divTableForecast]
      .forEach(el => el.innerHTML = '')
  }
  if (chartTypes === "retro" || chartTypes === null || chartTypes === undefined) {
    [divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc, divYearlyPeaks, divRasterHydrograph, divCumulativeVolume]
      .forEach(el => el.innerHTML = '')
  }
}

const showChartView = (modal) => {
  M.Modal.getInstance(divModalCharts).open()
  if (modal === 'forecast') {
    document.getElementById("forecastChartSpace").classList.remove('dissolve-backwards')
    document.getElementById("retroChartSpace").classList.add('dissolve-backwards')
    document.getElementById('showForecastCharts').classList.add('active')
    document.getElementById('showRetroCharts').classList.remove('active')
  } else if (modal === 'retro') {
    document.getElementById("forecastChartSpace").classList.add('dissolve-backwards')
    document.getElementById("retroChartSpace").classList.remove('dissolve-backwards')
    document.getElementById('showForecastCharts').classList.remove('active')
    document.getElementById('showRetroCharts').classList.add('active')
  }
}
const resetFilterForm = () => {
  selectRiverCountry.value = ""
  selectOutletCountry.value = ""
  selectVPU.value = ""
  definitionString.value = ""
  definitionDiv.value = ""
  M.FormSelect.init(selectRiverCountry)
  M.FormSelect.init(selectOutletCountry)
  M.FormSelect.init(selectVPU)
}
const buildFilterExpression = () => {
  const riverCountry = M.FormSelect.getInstance(selectRiverCountry).getSelectedValues()
  const outletCountry = M.FormSelect.getInstance(selectOutletCountry).getSelectedValues()
  const vpu = M.FormSelect.getInstance(selectVPU).getSelectedValues()
  const customString = definitionString.value
  if (!riverCountry.length && !outletCountry.length && !vpu.length && customString === "") return M.Modal.getInstance(modalFilter).close()

  let definitions = []
  if (riverCountry.length) riverCountry.forEach(c => definitions.push(`rivercountry='${c}'`))
  if (outletCountry.length) outletCountry.forEach(c => definitions.push(`outletcountry='${c}'`))
  if (vpu.length) vpu.forEach(v => definitions.push(`vpu=${v}`))
  if (customString !== "") definitions.push(customString)

  const filter = definitions.join(" OR ")
  definitionDiv.value = filter
  return filter
}
const updateHash = ({lon, lat, zoom, definition}) => {
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  hashParams.set('lon', lon ? lon.toFixed(2) : hashParams.get('lon'))
  hashParams.set('lat', lat ? lat.toFixed(2) : hashParams.get('lat'))
  hashParams.set('zoom', zoom ? zoom.toFixed(2) : hashParams.get('zoom'))
  hashParams.set('definition', definition ? definition : hashParams.get('definition') || "")
  window.location.hash = hashParams.toString()
}

const displayRiverNumber = riverId => {
  divSelectedRiverId.innerText = riverId ? riverId : ""
  clearCharts()
}
const displayLoadingStatus = statusChanges => {
  const statusIcons = {
    'clear': "",
    'ready': "&check;",
    'fail': "&times;",
    'load': '&darr;'
  }
  // place loading icons only if the load message is new to avoid flickering/rerendering that tag
  if ("forecast" in statusChanges) {
    document.getElementById("forecast-load-icon").innerHTML = statusIcons[statusChanges.forecast]
    if (statusChanges.forecast === "load") {
      divChartForecast.innerHTML = loadingImageTag
    }
  }
  if ("retro" in statusChanges) {
    document.getElementById("retro-load-icon").innerHTML = statusIcons[statusChanges.retro]
    if (statusChanges.retro === "load") {
      divChartRetro.innerHTML = loadingImageTag
    }
  }
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

const toggleVisibleRiverInput = () => riverIdInputContainer.classList.toggle("hide")

//// Export Functions
window.showChartView = showChartView
window.toggleVisibleRiverInput = toggleVisibleRiverInput

export {
  showChartView, updateHash, resetFilterForm, buildFilterExpression,
  toggleVisibleRiverInput, displayRiverNumber, displayLoadingStatus,
  updateDownloadLinks, clearCharts,
}
