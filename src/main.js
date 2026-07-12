// Auth initializes first: registers the onAuthStateChange listener and
// captures the recovery-URL snapshot before any top-level awaits / Supabase.
import {bootstrapAuth} from "@geoglows/geoglows-auth/bootstrap"
import "@geoglows/geoglows-auth/core/sign-in.css"

bootstrapAuth({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  portalUrl: import.meta.env.VITE_PORTAL_URL,
})

import "./css/main.css"
import "./css/tailwind-customizations.css"
import "./css/report.print.css"

import {closeModal, initComponents, openModal, showToast} from "./components.js";
import {clearCharts, displayLoadingStatus, displayRiverNumber, divModalCharts, inputForecastDate, riverIdInput, updateDownloadLinks} from "./ui.js";
import {hydrateLanguageTags, loadLocale, translationDictionary} from "./intl.js";
import {getAndCacheForecast, getAndCacheRetrospective, getAndCacheReturnPeriods} from "./data/main.js";
import {bookmarks} from "./bookmarks.js";
import {Lang, LoadStatus, RiverId, UseBiasCorrected, UseShowExtraRetroGraphs, UseSimpleForecast} from "./states/state.js";
import {plotAllForecast, plotAllRetro} from "./plots.js";
import "./map.js"
import "./reports.js"

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
initComponents();
if (window.innerWidth < 800) showToast(translationDictionary.prompts.mobile, {type: "info", duration: 7500})

const fetchData = ({riverId, display = true} = {}) => {
  if (display) openModal(divModalCharts)
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

// Language change subscribers
Lang.addSubscriber(() => fetchData({display: false}))
Lang.addSubscriber(() => displayRiverNumber(RiverId.get()))  // the language change sets the default prompt for "select a river" so we need to reapply the number if selected

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
  else alert(translationDictionary.prompts.invalidRiverID)
  closeModal('enter-river-id-modal')
}
riverIdInput.addEventListener("keydown", event => {
  if (event.key === "Enter") setRiverIdFromInput()
})

document.querySelectorAll('#language-select a[data-lang]').forEach(el => {
  el.addEventListener('click', async e => {
    e.preventDefault()
    const newLang = el.dataset.lang
    if (newLang === Lang.get()) return
    await loadLocale(newLang)
    hydrateLanguageTags()
    Lang.set(newLang)  // subscribers fire after translationDictionary is already updated
  })
})
