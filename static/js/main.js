import {
  hideRiverInput,
  inputForecastDate,
  outletCountriesJSON,
  riverCountriesJSON,
  riverIdInput,
  riverIdInputContainer,
  selectOutletCountry,
  selectRiverCountry,
  selectVPU,
  vpuListJSON
} from "./ui.js";
import {getForecastData, getRetrospectiveData} from "./data.js";
import {loadStatusManager, selectedRiverId} from "./state.js";

//// Initialize Modal Values
fetch(riverCountriesJSON)
  .then(response => response.json())
  .then(response => {
    selectRiverCountry.innerHTML += response.map(c => `<option value="${c}">${c}</option>`).join('')
    M.FormSelect.init(selectRiverCountry)
  })
fetch(outletCountriesJSON)
  .then(response => response.json())
  .then(response => {
    selectOutletCountry.innerHTML += response.map(c => `<option value="${c}">${c}</option>`).join('')
    M.FormSelect.init(selectOutletCountry)
  })
fetch(vpuListJSON)
  .then(response => response.json())
  .then(response => {
    selectVPU.innerHTML += response.map(v => `<option value="${v}">${v}</option>`).join('')
    M.FormSelect.init(selectVPU)
  })

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
M.AutoInit()
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
window.getForecastData = getForecastData
window.getRetrospectiveData = getRetrospectiveData
