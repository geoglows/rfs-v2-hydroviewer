/// URLs
import {updateDownloadLinks} from "./data.js";
import {clearCharts} from "./plots.js";

export const RFS_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'

//// DOM Elements
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

// Misc constants
export const lang = window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en-US'
const loadingImageTag = `<img src="/static/img/loading.gif" alt="loading">`


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

const displayRiverNumber = (riverid) => {
  divSelectedRiverId.innerText = riverid ? riverid : ""
  updateDownloadLinks(riverid)
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

const toggleVisibleRiverInput = () => riverIdInputContainer.classList.toggle("hide")

//// Export Functions
window.showChartView = showChartView
window.toggleVisibleRiverInput = toggleVisibleRiverInput

export {
  showChartView, updateHash, resetFilterForm, buildFilterExpression,
  toggleVisibleRiverInput, displayRiverNumber, displayLoadingStatus,
}
