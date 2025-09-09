import {displayLoadingStatus, displayRiverNumber, lang, riverIdInput} from "./ui.js";
import {fetchData} from "./data.js";
import {bookmarks} from "./bookmarks.js";
import {LoadStatus, RiverId, UseBiasCorrected} from "./states/state.js";

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
M.AutoInit();
M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), {
  coverTrigger: false,
  alignment: 'right',
  constrainWidth: false
});
Plotly.setPlotConfig({'locale': lang})
if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 7500})

// subscribers to RiverId changes - don't change the order
RiverId.subscribe(LoadStatus.reset)
RiverId.subscribe(displayRiverNumber)
RiverId.subscribe(fetchData)
RiverId.subscribe(bookmarks.setFavoriteIcon)

// subscribers to loadingStatus changes
LoadStatus.subscribe(displayLoadingStatus)

// UseBiasCorrected subscriber to sync checkbox state
UseBiasCorrected.subscribe(() => fetchData({display: false}))

// event listeners
const forecastDatePicker = document.getElementById('forecast-date-calendar')
const previousDateArrow = document.getElementById('datepicker-previous')
const nextDateArrow = document.getElementById('datepicker-next')
const earliestDateObj = new Date(Date.UTC(2024, 6, 1))
const latestDateObj = new Date(Date.now() - 12 * 60 * 60 * 1000)
const earliestDate = earliestDateObj.toISOString().slice(0, 10)
const latestDate = latestDateObj.toISOString().slice(0, 10)
forecastDatePicker.min = earliestDate
forecastDatePicker.max = latestDate
forecastDatePicker.value = latestDate
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
riverIdInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return
  let possibleId = riverIdInput.value
  if (/^\d{9}$/.test(possibleId)) RiverId.set(parseInt(possibleId))
  else alert(text.prompts.invalidRiverID)
  M.Modal.getInstance(document.getElementById('enter-river-id-modal')).close()
})

// set global variables for html inline
window.setRiverId = RiverId.set
