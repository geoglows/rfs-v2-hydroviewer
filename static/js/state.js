import {divChartForecast, divChartRetro, divSelectedRiverId, divTableForecast, riverIdInput} from "./ui.js";
import {fetchData, updateDownloadLinks} from "./data.js";

const selectedRiverId = (() => {
  let riverId = null

  const set = newId => {
    if (!newId) {
      let possibleId = riverIdInput.value
      if (!/^\d{9}$/.test(possibleId)) return alert(text.prompts.invalidRiverID)
      newId = possibleId
    }
    riverId = newId
  }
  const setAndFetch = newId => {
    set(newId)
    updateDownloadLinks(riverId)
    fetchData(newId)
  }

  const get = () => riverId

  return {set, setAndFetch, get}
})()

const loadStatusManager = (() => {
  const loadingStatusDivs = Array.from(document.getElementsByClassName("load-status"))
  let status = {
    riverid: null,
    forecast: "clear",
    retro: "clear",
  }

  const statusIcons = {
    'clear': "",
    'ready': "&check;",
    'fail': "&times;",
    'load': '&darr;'
  }

  const loadingImageTag = `<img src="../static/img/loading.gif" alt="loading">`

  const update = object => {
    for (let key in object) status[key] = object[key]
    // place loading icons but only if that load message is new to avoid flickering/rerendering that tag
    if (status.forecast === "load" && "forecast" in object) {
      divChartForecast.innerHTML = loadingImageTag
      divTableForecast.innerHTML = ''
    }
    if (status.retro === "load" && "retro" in object) divChartRetro.innerHTML = loadingImageTag
    divSelectedRiverId.innerText = status.riverid ? status.riverid : ""

    document.getElementById("forecast-load-icon").innerHTML = statusIcons[status.forecast]
    document.getElementById("retro-load-icon").innerHTML = statusIcons[status.retro]
  }

  return {
    update
  }
})()

const checkShowMembers = document.getElementById('settingsShowEnsembleMembers')
const checkUseBiasCorrected = document.getElementById('settingsUseBiasCorrected')

const useForecastMembers = () => checkShowMembers.checked
const useBiasCorrected = () => checkUseBiasCorrected.checked

// set event listeners and sync state with localStorage values on first load
checkShowMembers.addEventListener('change', () => localStorage.setItem('showEnsembleMembers', checkShowMembers.checked))
checkShowMembers.checked = localStorage.getItem('showEnsembleMembers') === 'true' || false

checkUseBiasCorrected.addEventListener('change', () => localStorage.setItem('useBiasCorrected', checkUseBiasCorrected.checked))
checkUseBiasCorrected.checked = localStorage.getItem('useBiasCorrected') === 'true' || false

export {
  loadStatusManager, selectedRiverId,
  useForecastMembers, useBiasCorrected
}
