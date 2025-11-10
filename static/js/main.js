import {clearCharts, displayLoadingStatus, displayRiverNumber, divModalCharts, inputForecastDate, lang, riverIdInput, updateDownloadLinks} from "./ui.js";
import {getAndCacheForecast, getAndCacheRetrospective, getAndCacheReturnPeriods} from "./data/main.js";
import {bookmarks} from "./bookmarks.js";
import {LoadStatus, RiverId, UseBiasCorrected, UseShowExtraRetroGraphs, UseSimpleForecast} from "./states/state.js";
import {plotAllForecast, plotAllRetro} from "./plots.js";

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
M.AutoInit();
M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), {
  coverTrigger: false,
  alignment: 'right',
  constrainWidth: false
});
Plotly.setPlotConfig({'locale': lang})
if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 7500})

const fetchData = ({riverId, display = true} = {}) => {
  if (display) M.Modal.getInstance(divModalCharts).open()
  riverId = riverId || RiverId.get()
  if (!riverId) return
  const date = inputForecastDate.value.replaceAll("-", "")
  const corrected = UseBiasCorrected.get()
  const stats = UseSimpleForecast.get()
  clearCharts('forecast')
  clearCharts('retro')
  LoadStatus.update({forecast: "load", retro: "load"})
  Promise
    .all([getAndCacheForecast({riverId, date, corrected}), getAndCacheReturnPeriods({riverId, corrected})])
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

// subscribers to RiverId changes - don't change the order
RiverId.addSubscriber(LoadStatus.reset)
RiverId.addSubscriber(displayRiverNumber)
RiverId.addSubscriber(() => updateDownloadLinks({clear: true}))
RiverId.addSubscriber(fetchData)
RiverId.addSubscriber(bookmarks.setFavoriteIcon)

// subscribers to loadingStatus changes
LoadStatus.addSubscriber(displayLoadingStatus)

// Settings state subscribers
UseSimpleForecast.addSubscriber(() => fetchData({display: false}))
UseBiasCorrected.addSubscriber(() => fetchData({display: false}))
UseShowExtraRetroGraphs.addSubscriber(() => fetchData({display: false}))

// event listeners
const forecastDatePicker = document.getElementById('forecast-date-calendar')
const reportDatePicker = document.getElementById('report-date-calendar')
const previousDateArrow = document.getElementById('datepicker-previous')
const nextDateArrow = document.getElementById('datepicker-next')
const earliestDateObj = new Date(Date.UTC(2024, 6, 1))
const latestDateObj = new Date(Date.now() - 12 * 60 * 60 * 1000)
const earliestDate = earliestDateObj.toISOString().slice(0, 10)
const latestDate = latestDateObj.toISOString().slice(0, 10)
forecastDatePicker.min = earliestDate
forecastDatePicker.max = latestDate
forecastDatePicker.value = latestDate
reportDatePicker.min = earliestDate
reportDatePicker.max = latestDate
reportDatePicker.value = latestDate
forecastDatePicker.onchange = () => {
  previousDateArrow.disabled = forecastDatePicker.value === earliestDate
  nextDateArrow.disabled = forecastDatePicker.value === latestDate
  fetchData()
}
previousDateArrow.onclick = () => {
  let date = new Date(forecastDatePicker.value + "T00:00:00Z")
  date.setUTCDate(date.getUTCDate() - 1)
  forecastDatePicker.value = date.toISOString().slice(0, 10)
  previousDateArrow.disabled = forecastDatePicker.value === earliestDate
  nextDateArrow.disabled = false
  fetchData()
}
nextDateArrow.onclick = () => {
  let date = new Date(forecastDatePicker.value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  forecastDatePicker.value = date.toISOString().slice(0, 10)
  previousDateArrow.disabled = false
  nextDateArrow.disabled = forecastDatePicker.value === latestDate
  fetchData()
}

window.setRiverIdFromInput = riverid => {
  let possibleId = riverid || riverIdInput.value
  if (/^\d{9}$/.test(possibleId)) RiverId.set(parseInt(possibleId))
  else alert(text.prompts.invalidRiverID)
  M.Modal.getInstance(document.getElementById('enter-river-id-modal')).close()
}
riverIdInput.addEventListener("keydown", event => {
  if (event.key === "Enter") setRiverIdFromInput()
})
