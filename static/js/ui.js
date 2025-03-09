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
const divModalForecasts = document.getElementById("forecast-modal")
const divModalRetro = document.getElementById("retro-modal")
// charts
const divChartForecast = document.getElementById("forecastPlot")
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
const showModal = (modal) => {
  switch (modal) {
    case "forecast":
      M.Modal.getInstance(divModalForecasts).open()
      M.Modal.getInstance(divModalRetro).close()
      break
    case "retro":
      M.Modal.getInstance(divModalForecasts).close()
      M.Modal.getInstance(divModalRetro).open()
      break
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
    riverid: "clear",
    forecast: "clear",
    retro: "clear",
  }
  let messages = {
    riverid: "",
    forecast: "",
    retro: "",
  }

  const loadingImageTag = `<img src="${LOADING_GIF}" alt='loading'>`

  const update = object => {
    for (let key in object) status[key] = object[key]

    // place loading icons but only if that load message is new to avoid flickering/rerendering that tag
    if (status.forecast === "load" && "forecast" in object) divChartForecast.innerHTML = loadingImageTag
    if (status.retro === "load" && "retro" in object) divChartRetro.innerHTML = loadingImageTag
    updateMessages()
    display()
  }

  const updateMessages = () => {
    messages.riverid = status.riverid === "clear" ? text.inputs.enterRiverId : `${text.words.riverid}: ${typeof status.riverid === "number" ? status.riverid : text.status[status.riverid]}`
    messages.forecast = `${text.words.forecast}: ${text.status[status.forecast]}`
    messages.retro = `${text.words.retro}: ${text.status[status.retro]}`
  }

  const display = () => {
    loadingStatusDivs
      .forEach(el => el.innerHTML = ['riverid', 'forecast', 'retro']
        .map(key => {
          const modalFunction = key === "forecast" ? "showModal('forecast')" : key === "retro" ? "showModal('retro')" : "setRiverId()";
          return `<button class="btn-flat status-btn status-${status[key]}" onclick="${modalFunction}">${messages[key]}</button>`;
        })
        .join('')
      )
  }

  updateMessages()

  return {
    update
  }
}

//// Export Functions
window.showModal = showModal
export {
  loadStatusManager, showModal, updateHash, resetFilterForm, buildFilterExpression,
  divChartForecast, divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc,
  lang
}