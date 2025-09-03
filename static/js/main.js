import {hideRiverInput, inputForecastDate, lang, riverIdInput, riverIdInputContainer} from "./ui.js";
import {getForecastData} from "./data.js";
import {loadStatusManager, selectedRiverId} from "./state.js";

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
M.AutoInit();

Plotly.setPlotConfig({'locale': lang})

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
