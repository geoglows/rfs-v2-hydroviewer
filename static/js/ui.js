//// Constants
const riverCountriesJSON = '../static/json/riverCountries.json'
const outletCountriesJSON = '../static/json/outletCountries.json'
const vpuListJSON = '../static/json/vpuList.json'
const LOADING_GIF = '../static/img/loading.gif'
const lang = window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en-US'

//// DOM Elements
// filter inputs
const selectRiverCountry = document.getElementById('riverCountry')
const selectOutletCountry = document.getElementById('outletCountry')
const selectVPU = document.getElementById('vpuSelect')
const definitionString = document.getElementById("definitionString")
const definitionDiv = document.getElementById("definition-expression")
// modals
const divModalCharts = document.getElementById("charts-modal")
// charts
const divSelectedRiverId = document.getElementById("selected-river-id")
const riverIdInputContainer = document.getElementById('enter-river-id-container')
const riverIdInput = document.getElementById("river-id")
const divChartForecast = document.getElementById("forecastPlot")
const divTableForecast = document.getElementById("forecastTable")
const divChartRetro = document.getElementById("retroPlot")
const divChartYearlyVol = document.getElementById("yearlyVolPlot")
const divChartStatus = document.getElementById("yearlyStatusPlot")
const divChartFdc = document.getElementById("fdcPlot")

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
const showChartView = (modal) => {
  M.Modal.getInstance(divModalCharts).open()
  if (modal === 'forecast') {
    document.getElementById("forecastChartSpace").classList.remove('dissolve-backwards')
    document.getElementById("retroChartSpace").classList.add('dissolve-backwards')
    document.getElementById('showForecastCharts').classList.add('active')
    document.getElementById('showRetroCharts').classList.remove('active')
  } else if (modal === 'retro') {
    document.getElementById("forecastChartSpace").classList.add('dissolve-backwards')
    document.getElementById("retroChartSpace").classList.remove('dissolve-backwards')
    document.getElementById('showForecastCharts').classList.remove('active')
    document.getElementById('showRetroCharts').classList.add('active')
  }
}
const resetFilterForm = () => {
  selectRiverCountry.value = ""
  selectOutletCountry.value = ""
  selectVPU.value = ""
  definitionString.value = ""
  definitionDiv.value = ""
  M.FormSelect.init(selectRiverCountry)
  M.FormSelect.init(selectOutletCountry)
  M.FormSelect.init(selectVPU)
}
const buildFilterExpression = () => {
  const riverCountry = M.FormSelect.getInstance(selectRiverCountry).getSelectedValues()
  const outletCountry = M.FormSelect.getInstance(selectOutletCountry).getSelectedValues()
  const vpu = M.FormSelect.getInstance(selectVPU).getSelectedValues()
  const customString = definitionString.value
  if (!riverCountry.length && !outletCountry.length && !vpu.length && customString === "") return M.Modal.getInstance(modalFilter).close()

  let definitions = []
  if (riverCountry.length) riverCountry.forEach(c => definitions.push(`rivercountry='${c}'`))
  if (outletCountry.length) outletCountry.forEach(c => definitions.push(`outletcountry='${c}'`))
  if (vpu.length) vpu.forEach(v => definitions.push(`vpu=${v}`))
  if (customString !== "") definitions.push(customString)

  const filter = definitions.join(" OR ")
  definitionDiv.value = filter
  return filter
}
const updateHash = ({lon, lat, zoom, definition}) => {
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  hashParams.set('lon', lon ? lon.toFixed(2) : hashParams.get('lon'))
  hashParams.set('lat', lat ? lat.toFixed(2) : hashParams.get('lat'))
  hashParams.set('zoom', zoom ? zoom.toFixed(2) : hashParams.get('zoom'))
  hashParams.set('definition', definition ? definition : hashParams.get('definition') || "")
  window.location.hash = hashParams.toString()
}

//// Load Status Manager
const loadStatusManager = () => {
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

  const loadingImageTag = `<img src="${LOADING_GIF}" alt='loading'>`

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
}

const toggleVisibleRiverInput = () => riverIdInputContainer.classList.toggle("hide")
const hideRiverInput = () => {
  riverIdInputContainer.classList.add("hide")
  riverIdInput.value = ""
}

//// Export Functions
window.showChartView = showChartView
window.toggleVisibleRiverInput = toggleVisibleRiverInput

export {
  loadStatusManager, showChartView, updateHash, resetFilterForm, buildFilterExpression,
  hideRiverInput, toggleVisibleRiverInput,
  riverIdInput, riverIdInputContainer,
  divChartForecast, divTableForecast, divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc,
  lang
}