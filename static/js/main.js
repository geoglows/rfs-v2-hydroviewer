import {hideRiverInput, inputForecastDate, riverIdInput, riverIdInputContainer} from "./ui.js";
import {getForecastData} from "./data.js";
import {loadStatusManager, selectedRiverId} from "./state.js";
import {riverBookmarks} from "./bookmarks.js";

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
M.AutoInit();

// on opening the #bookmarks-modal, populate the table of bookmarks
M.Modal.init(document.getElementById('bookmarks-modal'), {
  onOpenStart: () => document.getElementById('bookmarks-tbody').innerHTML = riverBookmarks.table()
})

loadStatusManager.update()
if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 7500})
inputForecastDate.addEventListener("change", () => getForecastData())
riverIdInput.addEventListener("keydown", event => {
  if (event.key !== "Enter") return
  let possibleId = riverIdInput.value
  if (!riverIdInputContainer.classList.contains("hide") && /^\d{9}$/.test(possibleId)) {
    hideRiverInput()
    selectedRiverId.setAndFetch(possibleId)
  } else alert(text.prompts.invalidRiverID)
})

//////////////////////////////////////////////////////////////////////// Export alternatives
window.setRiverId = selectedRiverId.setAndFetch
