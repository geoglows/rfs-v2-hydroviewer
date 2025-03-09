require([
  "esri/layers/MapImageLayer",
  "esri/layers/ImageryLayer",
  "esri/layers/TileLayer",
  "esri/layers/WebTileLayer",
  "esri/layers/FeatureLayer",
  "esri/widgets/TimeSlider",
  "esri/core/reactiveUtils",
  "esri/intl",
  "esri/config",
], (MapImageLayer, ImageryLayer, TileLayer, WebTileLayer, FeatureLayer, TimeSlider, reactiveUtils, intl, config) => {
  document.querySelector('arcgis-map').addEventListener('arcgisViewReadyChange', (e) => {
    //////////////////////////////////////////////////////////////////////// Constants and Elements
    const RFS_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
    const MIN_QUERY_ZOOM = 11
    const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'
    const LOADING_GIF = '../static/img/loading.gif'
    const riverCountriesJSON = '../static/json/riverCountries.json'
    const outletCountriesJSON = '../static/json/outletCountries.json'
    const vpuListJSON = '../static/json/vpuList.json'
    // manipulated elements
    const inputForecastDate = document.getElementById('forecast-date-calendar')
    const timeSliderDiv = document.getElementById('timeSlider')
    const riverName = document.getElementById('river-name')
    // filtering inputs
    const selectRiverCountry = document.getElementById('riverCountry')
    const selectOutletCountry = document.getElementById('outletCountry')
    const selectVPU = document.getElementById('vpuSelect')
    const definitionString = document.getElementById("definitionString")
    const definitionDiv = document.getElementById("definition-expression")
    // modal elements
    const modalForecasts = document.getElementById("forecast-modal")
    const modalRetro = document.getElementById("retro-modal")
    const modalFilter = document.getElementById("filter-modal")
    // plots
    const chartForecast = document.getElementById("forecastPlot")
    const chartRetro = document.getElementById("retroPlot")
    const chartYearlyVol = document.getElementById("yearlyVolPlot")
    const chartYearlyStatus = document.getElementById("yearlyStatusPlot")
    const chartFdc = document.getElementById("fdcPlot")
    // styling and constants for retrospective data analysis/plots
    const percentiles = Array.from({length: 51}, (_, i) => i * 2)
    const sortedArrayToPercentiles = array => percentiles.toReversed().map(p => array[Math.floor(array.length * p / 100) - (p === 100 ? 1 : 0)])
    const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
    const secondsPerYear = 60 * 60 * 24 * 365.25
    const statusPercentiles = [0, 13, 28, 72, 87]
    const statusColors = ['rgb(44, 125, 205)', 'rgb(142, 206, 238)', 'rgb(231,226,188)', 'rgb(255, 168, 133)', 'rgb(205, 35, 63)']
    const statusLabels = ['Very Wet', 'Wet', 'Normal', 'Dry', 'Very Dry']
    const lang = window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en-US'
    const months = Array.from({length: 12}).map((_, idx) => (idx + 1).toString().padStart(2, '0'))
    const monthNames = months.map(m => new Date(2021, parseInt(m, 10) - 1, 1).toLocaleString(lang, {month: 'short'}))

////////////////////////////////////////////////////////////////////////  Modals, UI
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
    const showForecastModal = () => {
      M.Modal.getInstance(modalForecasts).open()
      M.Modal.getInstance(modalRetro).close()
    }
    const showRetroModal = () => {
      M.Modal.getInstance(modalForecasts).close()
      M.Modal.getInstance(modalRetro).open()
    }
    const updateHash = ({lon, lat, zoom, definition}) => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      hashParams.set('lon', lon ? lon.toFixed(2) : hashParams.get('lon'))
      hashParams.set('lat', lat ? lat.toFixed(2) : hashParams.get('lat'))
      hashParams.set('zoom', zoom ? zoom.toFixed(2) : hashParams.get('zoom'))
      hashParams.set('definition', definition ? definition : hashParams.get('definition') || "")
      window.location.hash = hashParams.toString()
    }
    const resetDefinitionForm = () => {
      selectRiverCountry.value = ""
      selectOutletCountry.value = ""
      selectVPU.value = ""
      definitionString.value = ""
      definitionDiv.value = ""
      M.FormSelect.init(selectRiverCountry)
      M.FormSelect.init(selectOutletCountry)
      M.FormSelect.init(selectVPU)
    }
    const updateDownloadLinks = riverid => {
      const hrefForecast = riverid ? `${REST_ENDPOINT}/forecast/${riverid}` : ""
      const hrefRetro = riverid ? `${REST_ENDPOINT}/retrospective/${riverid}` : ""
      document.getElementById("download-forecast-link").href = hrefForecast
      document.getElementById("download-retrospective-link").href = hrefRetro
      document.getElementById("download-forecast-btn").disabled = !riverid
      document.getElementById("download-retrospective-btn").disabled = !riverid
    }
    const clearChartDivs = chartTypes => {
      if (chartTypes === "forecast" || chartTypes === null) {
        [chartForecast,]
          .forEach(el => el.innerHTML = '')
      }
      if (chartTypes === "retrospective" || chartTypes === null) {
        [chartRetro, chartYearlyVol, chartYearlyStatus, chartFdc]
          .forEach(el => el.innerHTML = '')
      }
    }
    const loadStatus = (() => {
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

      const update = object => {
        for (let key in object) status[key] = object[key]
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
              const modalFunction = key === "forecast" ? "showForecastModal()" : key === "retro" ? "showRetroModal()" : "setRiverId()";
              return `<button class="btn-flat status-btn status-${status[key]}" onclick="${modalFunction}">${messages[key]}</button>`;
            })
            .join('')
          )
      }

      updateMessages()

      return {
        update
      }
    })()

//////////////////////////////////////////////////////////////////////// Plots
    const plotForecast = ({forecast, rp, riverid}) => {
      chartForecast.innerHTML = ""
      const maxForecast = Math.max(...forecast.flow_median)
      const returnPeriods = returnPeriodShapes({rp, x0: forecast.datetime[0], x1: forecast.datetime[forecast.datetime.length - 1], maxFlow: maxForecast})
      Plotly.newPlot(
        chartForecast,
        [
          {
            x: forecast.datetime.concat(forecast.datetime.slice().toReversed()),
            y: forecast.flow_uncertainty_lower.concat(forecast.flow_uncertainty_upper.slice().toReversed()),
            name: `${text.plots.fcLineUncertainty}`,
            fill: 'toself',
            fillcolor: 'rgba(44,182,255,0.6)',
            line: {color: 'rgba(0,0,0,0)'}
          },
          {
            x: forecast.datetime,
            y: forecast.flow_uncertainty_lower,
            line: {color: 'rgb(0,166,255)'},
            showlegend: false,
            name: '',
          },
          {
            x: forecast.datetime,
            y: forecast.flow_uncertainty_upper,
            line: {color: 'rgb(0,166,255)'},
            showlegend: false,
            name: '',
          },
          {
            x: forecast.datetime,
            y: forecast.flow_median,
            name: `${text.plots.fcLineMedian}`,
            line: {color: 'black'}
          },
          ...returnPeriods,
        ],
        {
          title: `${text.plots.fcTitle} ${riverid}`,
          xaxis: {title: `${text.plots.fcXaxis} (UTC +00:00)`},
          yaxis: {title: `${text.plots.fcYaxis} (m³/s)`},
          legend: {'orientation': 'h'},
        }
      )
    }
    const plotRetroReport = ({retro, riverid}) => {
      clearChartDivs('retrospective')

      let monthlyAverages = []
      let yearlyVolumes = []
      let monthlyAverageTimeseries = {}
      let monthlyFdc = {}
      let monthlyStatusValues = {
        'Very Wet': [],
        'Wet': [],
        'Normal': [],
        'Dry': [],
        'Very Dry': [],
      }

      let monthlyValues = retro.datetime.reduce((acc, currentValue, currentIndex) => {
        const date = new Date(currentValue)
        const datestring = date.toISOString().slice(0, 7)
        if (!acc[datestring]) acc[datestring] = []
        acc[datestring].push(retro[riverid][currentIndex])
        return acc
      }, {})
      const totalFdc = sortedArrayToPercentiles(retro[riverid].toSorted((a, b) => a - b))
      const years = Array.from(new Set(Object.keys(monthlyValues).map(k => k.split('-')[0]))).sort((a, b) => a - b)

      Object
        .keys(monthlyValues)
        .forEach(k => monthlyAverageTimeseries[k] = monthlyValues[k].reduce((a, b) => a + b, 0) / monthlyValues[k].length)
      months
        .forEach(month => {
          const values = Object.keys(monthlyValues).filter(k => k.endsWith(`-${month}`)).map(k => monthlyValues[k]).flat().sort((a, b) => b - a)
          statusPercentiles.forEach((percentile, idx) => {
            monthlyStatusValues[Object.keys(monthlyStatusValues)[idx]].push(values[Math.floor(values.length * percentile / 100)])
          })
          monthlyAverages.push({month, value: values.reduce((a, b) => a + b, 0) / values.length})
          monthlyFdc[month] = sortedArrayToPercentiles(values.toReversed())
        })
      years
        .forEach(year => {
          const yearValues = Object.keys(monthlyAverageTimeseries).filter(k => k.startsWith(`${year}-`)).map(k => monthlyAverageTimeseries[k])
          if (yearValues.length === 12) yearlyVolumes.push({year, value: yearValues.reduce((a, b) => a + b, 0) / 12 * secondsPerYear / 1e6})
        })
      const fiveYearlyAverages = yearlyVolumes
        .reduce((acc, {year, value}) => {
          const period = Math.floor(year / 5) * 5
          let group = acc.find(g => g.period === period)
          if (!group) {
            group = {period, total: 0, count: 0}
            acc.push(group)
          }
          group.total += value
          group.count += 1
          return acc
        }, [])
        .map(({period, total, count}) => ({
          period,
          average: total / count
        }))

      Plotly.newPlot(
        chartRetro,
        [
          {
            x: retro.datetime,
            y: retro[riverid],
            type: 'lines',
            name: 'Daily Average',
          },
          {
            x: Object.keys(monthlyAverageTimeseries),
            y: Object.values(monthlyAverageTimeseries),
            type: 'lines',
            name: 'Monthly Average',
            line: {color: 'rgb(0, 166, 255)'},
            visible: 'legendonly'
          }
        ],
        {
          title: `${text.plots.retroTitle} ${riverid}`,
          legend: {orientation: 'h', x: 0, y: 1},
          hovermode: 'x',
          yaxis: {
            title: `${text.plots.retroYaxis} (m³/s)`,
            range: [0, null]
          },
          xaxis: {
            title: `${text.plots.retroXaxis} (UTC +00:00)`,
            type: 'date',
            autorange: false,
            range: defaultDateRange,
            rangeslider: {},
            rangeselector: {
              buttons: [
                {
                  count: 1,
                  label: `1 ${text.words.year}`,
                  step: 'year',
                  stepmode: 'backward'
                },
                {
                  count: 5,
                  label: `5 ${text.words.years}`,
                  step: 'year',
                  stepmode: 'backward'
                },
                {
                  count: 10,
                  label: `10 ${text.words.years}`,
                  step: 'year',
                  stepmode: 'backward'
                },
                {
                  count: 30,
                  label: `30 ${text.words.years}`,
                  step: 'year',
                  stepmode: 'backward'
                },
                {
                  label: `${text.words.all}`,
                  count: retro.datetime.length,
                  step: 'day',
                }
              ]
            },
          }
        }
      )

      Plotly.newPlot(
        chartYearlyVol,
        [
          {
            x: yearlyVolumes.map(x => x.year),
            y: yearlyVolumes.map(y => y.value),
            type: 'line',
            name: 'Annual Volume',
            marker: {color: 'rgb(0, 166, 255)'}
          },
          ...fiveYearlyAverages.map((x, idx) => {
            return {
              x: [x.period, (idx + 1 < fiveYearlyAverages.length ? fiveYearlyAverages[idx + 1].period : x.period + 5)],
              y: [x.average, x.average],
              type: 'scatter',
              mode: 'lines',
              legendgroup: '5 Yearly Averages',
              showlegend: idx === 0,
              name: '5 Yearly Averages',
              marker: {color: 'red'},
            }
          })
        ],
        {
          title: 'Yearly Cumulative Discharge Volume',
          legend: {orientation: 'h'},
          hovermode: 'x',
          xaxis: {title: 'Year (Complete Years Only)'},
          yaxis: {
            title: 'Million Cubic Meters (m³ * 10^6)',
            range: [0, null]
          }
        }
      )

      Plotly.newPlot(
        chartYearlyStatus,
        [
          ...statusColors.map((color, idx) => {
            const label = statusLabels[idx]
            const nextLabel = statusLabels[idx + 1]
            const lastEntry = idx === statusLabels.length - 1
            return {
              x: months.concat(...months.toReversed()),
              y: monthlyStatusValues[label].concat(lastEntry ? Array.from({length: 12}).fill(0) : monthlyStatusValues[nextLabel].toReversed()),
              mode: 'lines',
              fill: 'toself',
              name: label,
              line: {width: 0},
              fillcolor: color,
              legendgroup: 'Monthly Status Categories',
              legendgrouptitle: {text: 'Monthly Status Categories'},
            }
          }),
          {
            x: monthlyAverages.map(x => x.month),
            y: monthlyAverages.map(y => y.value),
            mode: 'lines',
            name: 'Monthly Average Flows',
            visible: 'legendonly',
            line: {color: 'rgb(0,0,0)', width: 3},
          },
          ...years.toReversed().map((year, idx) => {
            const values = Object
              .keys(monthlyAverageTimeseries)
              .filter(k => k.startsWith(`${year}-`))
              .map(k => monthlyAverageTimeseries[k])
              .flat()
            return {
              x: months,
              y: values,
              name: `Year ${year}`,
              visible: idx === 0 ? true : 'legendonly',
              mode: 'lines',
              line: {width: 2, color: 'black'}
            }
          })
        ],
        {
          title: 'Annual Status by Month',
          xaxis: {
            title: 'Month',
            tickvals: months,
            ticktext: monthNames,
          },
          hovermode: 'x',
          yaxis: {
            title: 'Flow (m³/s)',
            range: [0, null]
          },
        }
      )

      Plotly.newPlot(
        chartFdc,
        [
          {
            x: percentiles,
            y: totalFdc,
            type: 'lines',
            name: 'Total Flow Duration Curve',
          },
          ...Object
            .keys(monthlyFdc)
            .sort()
            .map((m, idx) => {
              return {
                x: percentiles,
                y: monthlyFdc[m],
                type: 'line',
                name: `FDC: Month ${monthNames[idx]}`,
              }
            })
        ],
        {
          title: 'Total Flow Duration Curve',
          xaxis: {title: 'Percentile (%)'},
          yaxis: {
            title: 'Flow (m³/s)',
            range: [0, null]
          },
          legend: {orientation: 'h'},
          hovermode: 'x',
        }
      )
    }
    const returnPeriodShapes = ({rp, x0, x1, maxFlow}) => {
      const returnPeriodColors = {
        '2': 'rgb(254, 240, 1)',
        '5': 'rgb(253, 154, 1)',
        '10': 'rgb(255, 56, 5)',
        '25': 'rgb(255, 0, 0)',
        '50': 'rgb(128, 0, 106)',
        '100': 'rgb(128, 0, 246)',
      }
      const visible = maxFlow > rp.return_periods['2'] ? true : 'legendonly'
      const box = (y0, y1, name) => {
        return {
          x: [x0, x1, x1, x0],
          y: [y0, y0, y1, y1],
          fillcolor: returnPeriodColors[name],
          fill: 'toself',
          line: {width: 0},
          mode: 'lines',
          opacity: 0.5,
          legendgroup: 'returnperiods',
          legendgrouptitle: {text: `Return Periods m³/s`},
          showlegend: true,
          visible: visible,
          name: `${name}: ${rp.return_periods[name].toFixed(2)} m³/s`,
        }
      }
      return Object
        .keys(rp.return_periods)
        .map((key, index, array) => {
          const y0 = rp.return_periods[key]
          const y1 = index === array.length - 1 ? Math.max(rp.return_periods[key] * 1.15, maxFlow * 1.15) : rp.return_periods[array[index + 1]]
          return box(y0, y1, key)
        })
        .concat([{legendgroup: 'returnperiods', legendgrouptitle: {text: `Return Periods m³/s`}}])
    }

////////////////////////////////////////////////////////////////////////  Initial state and config
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    let lon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : 10
    let lat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : 18
    let zoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : 2.75
    let definitionExpression = hashParams.get('definition') || ""
    let riverId = null
    Plotly.setPlotConfig({'locale': lang})
    intl.setLocale(lang)
    config.request.interceptors.push({
      urls: /rfs-v2.s3-us-west-2.amazonaws.com/,
      before: params => {
        params.url = params.url.split('?')[0]
        delete params.requestOptions.query // prevent appending the _ts query param so tiles can be cached.
      }
    })
    // set the default date to 12 hours before now UTC time
    const now = new Date()
    now.setHours(now.getHours() - 12)
    inputForecastDate.value = now.toISOString().split("T")[0]

//////////////////////////////////////////////////////////////////////// Data Search Promises
    const searchLayerByClickPromise = event => {
      return new Promise((resolve, reject) => {
        rfsLayer
          .findSublayerById(0)
          .queryFeatures({
            geometry: event.mapPoint,
            distance: 125,
            units: "meters",
            spatialRelationship: "intersects",
            outFields: ["*"],
            returnGeometry: true,
            definitionExpression,
          })
          .then(response => {
            if (!response.features.length) {
              M.toast({html: text.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
              return reject()
            }
            if (response.features[0].attributes.comid === "Null" || !response.features[0].attributes.comid) {
              loadStatus.update({riverid: "fail"})
              M.toast({html: text.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
              console.error(error)
              return reject()
            }
            return response
          })
          .then(response => resolve(response))
          .catch(() => reject())
      })
    }
    const fetchForecastPromise = ({riverid, date}) => {
      return new Promise((resolve, reject) => {
        // fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${inputForecastDate.value.replaceAll("-", "")}`)
        fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${date}`)
          .then(response => response.json())
          .then(response => resolve(response))
          .catch(() => reject())
      })
    }
    const fetchReturnPeriodsPromise = riverid => {
      return new Promise((resolve, reject) => {
        fetch(`${REST_ENDPOINT}/returnperiods/${riverid}/?format=json`)
          .then(response => response.json())
          .then(response => resolve(response))
          .catch(() => reject())
      })
    }
    const fetchRetroPromise = riverid => {
      return new Promise((resolve, reject) => {
        fetch(`${REST_ENDPOINT}/retrospective/${riverid}/?format=json`)
          .then(response => response.json())
          .then(response => resolve(response))
          .catch(() => reject())
      })
    }

//////////////////////////////////////////////////////////////////////// Layer Filtering and Events
    const buildDefinitionExpression = () => {
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
      return definitions.join(" OR ")
    }
    const updateLayerDefinitions = expression => {
      expression = expression === undefined ? buildDefinitionExpression() : expression
      rfsLayer.findSublayerById(0).definitionExpression = expression
      definitionExpression = expression
      definitionDiv.value = expression
      M.Modal.getInstance(modalFilter).close()
      updateHash({definition: expression})
    }
    const resetDefinitionExpression = () => {
      definitionExpression = ""
      resetDefinitionForm()
      updateLayerDefinitions(definitionExpression)
      updateHash({definition: definitionExpression})
    }

//////////////////////////////////////////////////////////////////////// Create map, view, layers, and map events
    const mapContainer = document.querySelector('arcgis-map')
    const map = mapContainer.map
    const view = mapContainer.view
    view.zoom = zoom
    view.center = [lon, lat]
    view.constraints = {
      rotationEnabled: false,
      snapToZoom: false,
      minZoom: 2,
    }

    const rfsLayer = new MapImageLayer({
      url: RFS_LAYER_URL,
      title: "GEOGLOWS River Forecast System v2",
      sublayers: [{id: 0, definitionExpression}]
    })
    const monthlyStatusLayer = new WebTileLayer({
      urlTemplate: `https://rfs-v2.s3-us-west-2.amazonaws.com/map-tiles/basin-status/2025-03/{level}/{col}/{row}.png`,
      title: "Monthly Status",
      visible: false,
      maxScale: 9244600,  // zoom level 6
    })
    const viirsFloodClassified = new WebTileLayer({
      urlTemplate: "https://floods.ssec.wisc.edu/tiles/RIVER-FLDglobal-composite/{level}/{col}/{row}.png",
      title: "NOAA-20 VIIRS Flood Composite",
      copyright: "University of Wisconsin-Madison SSEC",
      visible: false,
    });
    const viirsTrueColor = new ImageryLayer({
      portalItem: {id: "c873f4c13aa54b25b01270df9358dc64"},
      title: "NOAA-20 VIIRS True Color Corrected Reflectance",
      visible: false,
    })
    const viirsWaterStates = new ImageryLayer({
      portalItem: {id: "3695712d28354952923d2a26a176b767"},
      title: "NOAA-20 VIIRS Water States",
      visible: false,
    })
    const viirsThermalAnomalies = new FeatureLayer({
      portalItem: {id: "dece90af1a0242dcbf0ca36d30276aa3"},
      title: "NOAA-20 VIIRS Thermal Anomalies",
      visible: false,
    })
    const goesImageryColorized = new TileLayer({
      portalItem: {id: "37a875ff3611496883b7ccca97f0f5f4"},
      title: "GOES Weather Satellite Colorized Infrared Imagery",
      visible: false,
    })
    map.addMany([goesImageryColorized, viirsThermalAnomalies, viirsTrueColor, viirsWaterStates, viirsFloodClassified, monthlyStatusLayer, rfsLayer])

    const filterButton = document.createElement('div');
    filterButton.className = "esri-widget--button esri-widget esri-interactive";
    filterButton.innerHTML = `<span class="esri-icon-filter"></span>`;
    filterButton.addEventListener('click', () => M.Modal.getInstance(modalFilter).open());

    const timeSliderButton = document.createElement('div');
    timeSliderButton.className = "esri-widget--button esri-widget esri-interactive";
    timeSliderButton.innerHTML = `<span class="esri-icon-time-clock"></span>`;
    timeSliderButton.addEventListener('click', () => timeSliderDiv.classList.toggle('show-slider'))

    const timeSlider = new TimeSlider({
      container: "timeSlider",
      view: view,
      playRate: 1250,
      timeVisible: true,
      loop: true,
      expanded: false,
      mode: "instant",
    });

    view.navigation.browserTouchPanEnabled = true;
    view.ui.add(filterButton, "top-left");
    view.ui.add(timeSliderButton, "top-left");

    view.whenLayerView(rfsLayer.findSublayerById(0).layer).then(_ => {
      timeSlider.fullTimeExtent = rfsLayer.findSublayerById(0).layer.timeInfo.fullTimeExtent.expandTo("hours");
      timeSlider.stops = {interval: rfsLayer.findSublayerById(0).layer.timeInfo.interval}
    })

    reactiveUtils.when(
      () => view.stationary === true,
      () => updateHash({
        lon: view.center.longitude,
        lat: view.center.latitude,
        zoom: view.zoom,
        definition: definitionExpression
      })
    )

    view.on("click", event => {
      if (view.zoom < MIN_QUERY_ZOOM) return view.goTo({target: event.mapPoint, zoom: MIN_QUERY_ZOOM});
      M.toast({html: text.prompts.findingRiver, classes: "orange"})
      loadStatus.update({riverid: "load", forecast: "clear", retro: "clear"})
      searchLayerByClickPromise(event)
        .then(response => {
          riverId = response.features[0].attributes.comid
          view.graphics.removeAll()
          view.graphics.add({
            geometry: response.features[0].geometry,
            symbol: {
              type: "simple-line",
              color: [0, 0, 255],
              width: 3
            }
          })
          fetchData({riverid: riverId, referrer: "forecast"})
        })
    })

//////////////////////////////////////////////////////////////////////// GET DATA FROM API AND MANAGING PLOTS
    const getForecastData = riverid => {
      riverId = riverid ? riverid : riverId
      if (!riverId) return
      loadStatus.update({forecast: "load"})
      const date = inputForecastDate.value.replaceAll("-", "")
      Promise
        .all([fetchForecastPromise({riverid: riverId, date}), fetchReturnPeriodsPromise(riverId)])
        .then(responses => {
          plotForecast({forecast: responses[0], rp: responses[1], riverid: riverId})
          loadStatus.update({forecast: "ready"})
        })
        .catch(() => {
          loadStatus.update({forecast: "fail"})
        })
    }
    const getRetrospectiveData = () => {
      if (!riverId) return
      loadStatus.update({retro: "load"})
      clearChartDivs('retrospective')
      fetchRetroPromise(riverId)
        .then(response => {
          plotRetroReport({retro: response, riverid: riverId})
          loadStatus.update({retro: "ready"})
        })
        .catch(() => {
          loadStatus.update({retro: "fail"})
        })
    }
    const fetchData = ({riverid, referrer = null}) => {
      riverId = riverid ? riverid : riverId
      if (!riverId) return loadStatus.update({riverid: "fail"})
      loadStatus.update({riverid: riverId, forecast: "clear", retro: "clear"})
      clearChartDivs()
      updateDownloadLinks("set")
      if (referrer === 'forecast') {
        M.Modal.getInstance(modalForecasts).open()
      } else if (referrer === 'retro') {
        M.Modal.getInstance(modalRetro).open()
      }
      getForecastData()
      getRetrospectiveData()
    }
    const setRiverId = referrer => {
      riverId = parseInt(prompt(text.prompts.enterRiverID))
      if (!riverId) return
      if (!/^\d{9}$/.test(riverId)) return alert(text.prompts.invalidRiverID)
      fetchData({riverid: riverId, referrer: referrer})
    }

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
    M.AutoInit()
    loadStatus.update()
    if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 8000})
    inputForecastDate.addEventListener("change", () => getForecastData())
    window.addEventListener('resize', () => [chartForecast, chartRetro, chartYearlyVol, chartYearlyStatus, chartFdc].forEach(chart => Plotly.Plots.resize(chart)))

//////////////////////////////////////////////////////////////////////// Export alternatives
    window.setRiverId = setRiverId
    window.getForecastData = getForecastData
    window.getRetrospectiveData = getRetrospectiveData
    window.updateLayerDefinitions = updateLayerDefinitions
    window.resetDefinitionExpression = resetDefinitionExpression
    window.showForecastModal = showForecastModal
    window.showRetroModal = showRetroModal
  })
})
