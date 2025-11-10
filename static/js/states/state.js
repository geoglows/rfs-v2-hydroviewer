import {pubSubState} from "./pubSubState.js";

const RiverId = pubSubState({
  initialValue: null,
})
const LoadStatus = pubSubState({
  initialValue: {
    forecast: "clear",
    retro: "clear",
  },
  localStorageKey: null
})

// user controlled settings
const UseSimpleForecast = pubSubState({
  initialValue: localStorage.getItem('simpleForecast') === 'true' || true,
  localStorageKey: 'simpleForecast'
})
const UseBiasCorrected = pubSubState({
  initialValue: false,
})
const UseShowExtraRetroGraphs = pubSubState({
  initialValue: true,
  localStorageKey: 'showExtraRetroGraphs',
})

// set event listeners and sync state with localStorage values on first load
const checkSimpleForecast = document.getElementById('settingsShowSimpleForecast')
checkSimpleForecast.checked = UseSimpleForecast.get()
checkSimpleForecast.addEventListener('change', () => UseSimpleForecast.set(checkSimpleForecast.checked))

const checkShowExtraRetroGraphs = document.getElementById('settingsShowExtraRetroGraphs')
checkShowExtraRetroGraphs.checked = UseShowExtraRetroGraphs.get()
checkShowExtraRetroGraphs.addEventListener('change', () => UseShowExtraRetroGraphs.set(checkShowExtraRetroGraphs.checked))

const checkUseBiasCorrected = document.getElementById('settingsUseBiasCorrected')
checkUseBiasCorrected.addEventListener('click', event => {
  if (UseBiasCorrected.get()) {
    UseBiasCorrected.set(false)
    return
  }
  // if unchecked, instead of checking the box, open a model with warnings and confirmation dialog
  const modal = document.getElementById('biascorrectionwarning-modal')
  checkUseBiasCorrected.checked = false
  M.Modal.getInstance(modal).open()
})
document.getElementById('confirm-use-bias-correction').addEventListener('click', () => {
  UseBiasCorrected.set(true)
  checkUseBiasCorrected.checked = true
})

export {
  RiverId, LoadStatus, UseBiasCorrected, UseSimpleForecast, UseShowExtraRetroGraphs
}
