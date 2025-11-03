import {pubSubState} from "./stores.js";

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

// const checkUseBiasCorrected = document.getElementById('settingsUseBiasCorrected')
// checkUseBiasCorrected.checked = UseBiasCorrected.get()
// checkUseBiasCorrected.addEventListener('change', () => UseBiasCorrected.set(checkUseBiasCorrected.checked))

export {
  RiverId, LoadStatus, UseBiasCorrected, UseSimpleForecast, UseShowExtraRetroGraphs
}
