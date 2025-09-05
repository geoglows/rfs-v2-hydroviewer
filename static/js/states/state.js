import {pubSubState} from "./stores.js";

const RiverId = pubSubState({
  initialValue: null,
  localStorageKey: null
})
const LoadStatus = pubSubState({
  initialValue: {
    forecast: "clear",
    retro: "clear",
  },
  localStorageKey: null
})

// set event listeners and sync state with localStorage values on first load
const checkShowMembers = document.getElementById('settingsShowEnsembleMembers')
const useForecastMembers = () => checkShowMembers.checked
checkShowMembers.addEventListener('change', () => localStorage.setItem('showEnsembleMembers', checkShowMembers.checked))
checkShowMembers.checked = localStorage.getItem('showEnsembleMembers') === 'true' || false

const checkUseBiasCorrected = document.getElementById('settingsUseBiasCorrected')
const useBiasCorrected = () => checkUseBiasCorrected.checked
checkUseBiasCorrected.addEventListener('change', () => localStorage.setItem('useBiasCorrected', checkUseBiasCorrected.checked))
checkUseBiasCorrected.checked = localStorage.getItem('useBiasCorrected') === 'true' || false

export {
  RiverId, LoadStatus,
  useForecastMembers, useBiasCorrected,
}
