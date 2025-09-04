import {displayLoadingStatus, displayRiverNumber, inputForecastDate, lang, riverIdInput} from "./ui.js";
import {fetchData, getForecastData} from "./data.js";
import {bookmarks} from "./bookmarks.js";
import {LoadStatus, RiverId} from "./states/state.js";

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
M.AutoInit();
M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), {
  coverTrigger: false,
  alignment: 'right',
  constrainWidth: false
});
Plotly.setPlotConfig({'locale': lang})
if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 7500})

RiverId.subscribe(LoadStatus.reset)
RiverId.subscribe(fetchData) // as early as possible to start loading data
RiverId.subscribe(displayRiverNumber)
RiverId.subscribe(bookmarks.setFavoriteIcon)

// things that subscribe to loadingStatus changes
LoadStatus.subscribe(displayLoadingStatus)

inputForecastDate.addEventListener("change", () => getForecastData())
riverIdInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return
  let possibleId = riverIdInput.value
  if (/^\d{9}$/.test(possibleId)) RiverId.set(parseInt(possibleId))
  else alert(text.prompts.invalidRiverID)
  M.Modal.getInstance(document.getElementById('enter-river-id-modal')).close()
})

// set global variables for html inline
window.setRiverId = RiverId.set
