require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/layers/MapImageLayer",
  "esri/layers/ImageryLayer",
  "esri/layers/TileLayer",
  "esri/layers/WebTileLayer",
  "esri/layers/FeatureLayer",
  "esri/widgets/Home",
  "esri/widgets/BasemapGallery",
  "esri/widgets/ScaleBar",
  "esri/widgets/Legend",
  "esri/widgets/Expand",
  "esri/widgets/LayerList",
  "esri/widgets/TimeSlider",
  "esri/core/reactiveUtils",
  "esri/intl",
], (WebMap, MapView, MapImageLayer, ImageryLayer, TileLayer, WebTileLayer, FeatureLayer, Home, BasemapGallery, ScaleBar, Legend, Expand, LayerList, TimeSlider, reactiveUtils, intl) => {
  'use strict'

//////////////////////////////////////////////////////////////////////// Constants Variables
  const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'
  const RFS_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
  const MIN_QUERY_ZOOM = 11
  const LOADING_GIF = '../static/img/loading.gif'
  const riverCountriesJSON = '../static/json/riverCountries.json'
  const outletCountriesJSON = '../static/json/outletCountries.json'
  const vpuListJSON = '../static/json/vpuList.json'

  // parse language from the url path
  const lang = (window.location.pathname.split("/").filter(x => x && !x.includes(".html") && !x.includes('viewer'))[0] || 'en-US');
  Plotly.setPlotConfig({'locale': lang})
  intl.setLocale(lang)

  // styling and constants for retrospective data analysis/plots
  const percentiles = Array.from({length: 51}, (_, i) => i * 2)
  const sortedArrayToPercentiles = array => percentiles.toReversed().map(p => array[Math.floor(array.length * p / 100) - (p === 100 ? 1 : 0)])
  const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
  const months = Array.from({length: 12}).map((_, idx) => (idx + 1).toString().padStart(2, '0'))
  const monthNames = months.map(m => new Date(2021, parseInt(m, 10) - 1, 1).toLocaleString(lang, {month: 'short'}))
  const secondsPerYear = 60 * 60 * 24 * 365.25
  const statusPercentiles = [0, 13, 28, 72, 87]
  const monthlyStatusColors = {
    'Very Wet': 'rgb(44, 125, 205)',
    'Wet': 'rgb(142, 206, 238)',
    'Normal': 'rgb(231,226,188)',
    'Dry': 'rgb(255, 168, 133)',
    'Very Dry': 'rgb(205, 35, 63)',
  }

  // parse initial state from the hash
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  let lon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : 10
  let lat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : 18
  let zoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : 2.75
  const initialState = {
    lon: lon,
    lat: lat,
    zoom: zoom,
    definition: hashParams.get('definition') || "",
  }

//////////////////////////////////////////////////////////////////////// Element Selectors
  const loadStatusDivs = Array.from(document.getElementsByClassName("load-status"))
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
  const chartMonthlyAvg = document.getElementById("monthlyAvgPlot")
  const chartFdc = document.getElementById("fdcPlot")

//////////////////////////////////////////////////////////////////////// Manipulate Default Controls and DOM Elements
  let loadingStatus = {riverid: "clear", forecast: "clear", retro: "clear"}
  let definitionExpression = ""

  // cache of queried data
  const riverData = {
    id: null,
    name: null,
    forecast: null,
    retro: null,
    monthlyAverages: null,
    yearlyVolumes: null,
    monthlyAverageTimeseries: null,
    monthlyFdc: null,
    totalFdc: null,
  }
  let river = JSON.parse(JSON.stringify(riverData));
  // todo enable caching of data
  const setRiverData = (key, data) => {
    river[key] = data
    localStorage.setItem('riverData', JSON.stringify(river))
  }
  const clearRiverData = () => {
    river = JSON.parse(JSON.stringify(riverData))
    localStorage.setItem('river', JSON.stringify(river))
    clearChartDivs()
  }

  // set the default date to 12 hours before now UTC time
  const now = new Date()
  now.setHours(now.getHours() - 12)
  inputForecastDate.value = now.toISOString().split("T")[0]

  fetch(riverCountriesJSON)
    .then(response => response.json())
    .then(response => {
        selectRiverCountry.innerHTML += response.map(c => `<option value="${c}">${c}</option>`).join('')
        M.FormSelect.init(selectRiverCountry)
      }
    )
  fetch(outletCountriesJSON)
    .then(response => response.json())
    .then(response => {
        selectOutletCountry.innerHTML += response.map(c => `<option value="${c}">${c}</option>`).join('')
        M.FormSelect.init(selectOutletCountry)
      }
    )
  fetch(vpuListJSON)
    .then(response => response.json())
    .then(response => {
        selectVPU.innerHTML += response.map(v => `<option value="${v}">${v}</option>`).join('')
        M.FormSelect.init(selectVPU)
      }
    )

  // // date range picker by months from Jan 2000 to the most today's month
  // const dateRangePicker = M.Datepicker.init(inputForecastDate, {
  //   format: "yyyy-mm",
  //   defaultDate: now,
  //   setDefaultDate: true,
  //   minDate: new Date(2000, 0, 1),
  //   maxDate: new Date(),
  // })

////////////////////////////////////////////////////////////////////////  Create Layer, Map, View
  const rfsLayer = new MapImageLayer({
    url: RFS_LAYER_URL,
    title: "GEOGLOWS River Forecast System v2",
    sublayers: [{
      id: 0,
      definitionExpression: definitionExpression,
    }]
  })
  const monthlyStatusLayer = new WebTileLayer({
    // urlTemplate: `https://rfs-v2.s3-us-west-2.amazonaws.com/map-tiles/basin-status/${getStatusDate()}/{level}/{col}/{row}.png`,
    urlTemplate: `https://rfs-v2.s3-us-west-2.amazonaws.com/map-tiles/basin-status/{level}/{col}/{row}.png`,
    title: "Monthly Status",
    visible: false,
    maxScale: 9244600,
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

  const map = new WebMap({
    portalItem: {id: "a69f14ea2e784e019f4a4b6835ffd376"},
    title: "Environment Basemap",
    spatialReference: {wkid: 102100},
    legendEnabled: true,
  })
  const view = new MapView({
    container: "map",
    map: map,
    zoom: initialState.zoom,
    center: [initialState.lon, initialState.lat],
    constraints: {
      rotationEnabled: false,
      snapToZoom: false,
      minZoom: 2,
    },
  })
  const homeBtn = new Home({
    view: view
  })
  const scaleBar = new ScaleBar({
    view: view,
    unit: "dual"
  })
  const legend = new Legend({
    view: view
  })
  const legendExpand = new Expand({
    view: view,
    content: legend,
    expandTooltip: text.tooltips.legend,
    expanded: false
  })
  const basemapGallery = new BasemapGallery({
    view: view
  })
  const basemapExpand = new Expand({
    view: view,
    content: basemapGallery,
    expandTooltip: text.tooltips.basemap,
    expanded: false
  })
  const layerList = new LayerList({
    view: view
  })
  const layerListExpand = new Expand({
    view: view,
    content: layerList,
    expandTooltip: text.tooltips.layerList,
    expanded: false
  })
  const timeSlider = new TimeSlider({
    container: "timeSlider",
    view: view,
    playRate: 1250,
    timeVisible: true,
    loop: true,
    expanded: false,
    mode: "instant",
  });

  const filterButton = document.createElement('div');
  filterButton.className = "esri-widget--button esri-widget esri-interactive";
  filterButton.innerHTML = `<span class="esri-icon-filter"></span>`;
  filterButton.addEventListener('click', () => M.Modal.getInstance(modalFilter).open());

  const timeSliderButton = document.createElement('div');
  timeSliderButton.className = "esri-widget--button esri-widget esri-interactive";
  timeSliderButton.innerHTML = `<span class="esri-icon-time-clock"></span>`;
  timeSliderButton.addEventListener('click', () => timeSliderDiv.classList.toggle('show-slider'))

  view.ui.add(homeBtn, "top-left");
  view.ui.add(layerListExpand, "top-right")
  view.ui.add(basemapExpand, "top-right")
  view.ui.add(filterButton, "top-left");
  view.ui.add(scaleBar, "bottom-right");
  view.ui.add(legendExpand, "bottom-left");
  view.ui.add(timeSliderButton, "top-left");
  // view.ui.add(timeSliderExpand, "bottom-right");
  view.navigation.browserTouchPanEnabled = true;
  view.when(() => {
    map.layers.add(viirsFloodClassified)
    map.layers.add(goesImageryColorized)
    map.layers.add(viirsThermalAnomalies)
    map.layers.add(viirsWaterStates)
    map.layers.add(viirsTrueColor)
    map.layers.add(monthlyStatusLayer)
    map.layers.add(rfsLayer)
    view.whenLayerView(rfsLayer.findSublayerById(0).layer).then(_ => {
      timeSlider.fullTimeExtent = rfsLayer.findSublayerById(0).layer.timeInfo.fullTimeExtent.expandTo("hours");
      timeSlider.stops = {interval: rfsLayer.findSublayerById(0).layer.timeInfo.interval}
    })
  })  // layers should be added to webmaps after the view is ready


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
    definitionExpression = definitions.join(" OR ")
    return definitionExpression
  }
  const updateLayerDefinitions = expression => {
    expression = expression === undefined ? buildDefinitionExpression() : expression
    rfsLayer.findSublayerById(0).definitionExpression = expression
    definitionExpression = expression
    definitionDiv.value = expression
    M.Modal.getInstance(modalFilter).close()
    setHashDefinition(expression)
  }
  const resetDefinitionExpression = () => {
    // reset the selected values to All on each dropdown
    selectRiverCountry.value = ""
    selectOutletCountry.value = ""
    selectVPU.value = ""
    M.FormSelect.init(selectRiverCountry)
    M.FormSelect.init(selectOutletCountry)
    M.FormSelect.init(selectVPU)
    definitionString.value = ""
    // reset the definition expression to empty
    definitionExpression = ""
    rfsLayer.findSublayerById(0).definitionExpression = definitionExpression
    definitionDiv.value = definitionExpression
    // update the hash
    setHashDefinition(definitionExpression)
  }

//////////////////////////////////////////////////////////////////////// GET DATA FROM API AND MANAGING PLOTS
  const searchLayerByClickPromise = (event) => {
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
          definitionExpression: definitionExpression,
        })
        .then(response => {
          if (!response.features.length) {
            M.toast({html: text.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
            return reject()
          }
          if (response.features[0].attributes.comid === "Null" || !response.features[0].attributes.comid) {
            updateStatusIcons({riverid: "fail"})
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
  const fetchForecastPromise = riverid => {
    return new Promise((resolve, reject) => {
      fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${inputForecastDate.value.replaceAll("-", "")}`)
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
  const plotRetroReport = () => {
    clearChartDivs('retrospective')
    document.getElementById("monthlyAvgTimeseriesPlot").innerHTML = ''

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

    let monthlyValues = river.retro.datetime.reduce((acc, currentValue, currentIndex) => {
      const date = new Date(currentValue)
      const datestring = date.toISOString().slice(0, 7)
      if (!acc[datestring]) acc[datestring] = []
      acc[datestring].push(river.retro[river.id][currentIndex])
      return acc
    }, {})
    const totalFdc = sortedArrayToPercentiles(river.retro[river.id].toSorted((a, b) => a - b))
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
          x: river.retro.datetime,
          y: river.retro[river.id],
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
        title: `${text.plots.retroTitle} ${river.id}`,
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
                count: river.retro.datetime.length,
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
        {
          x: months.concat(...months.toReversed()),
          y: monthlyStatusValues['Very Wet'].concat(monthlyStatusValues['Wet'].toReversed()),
          mode: 'lines',
          fill: 'toself',
          name: 'Very Wet',
          line: {width: 0},
          fillcolor: monthlyStatusColors['Very Wet'],
          legendgroup: 'Monthly Status Categories',
          legendgrouptitle: {text: 'Monthly Status Categories'},
        },
        {
          x: months.concat(...months.toReversed()),
          y: monthlyStatusValues['Wet'].concat(monthlyStatusValues['Normal'].toReversed()),
          mode: 'lines',
          fill: 'toself',
          name: 'Wet',
          line: {width: 0},
          fillcolor: monthlyStatusColors['Wet'],
          legendgroup: 'Monthly Status Categories',
          legendgrouptitle: {text: 'Monthly Status Categories'},
        },
        {
          x: months.concat(...months.toReversed()),
          y: monthlyStatusValues['Normal'].concat(monthlyStatusValues['Dry'].toReversed()),
          mode: 'lines',
          fill: 'toself',
          name: 'Normal',
          line: {width: 0},
          fillcolor: monthlyStatusColors['Normal'],
          legendgroup: 'Monthly Status Categories',
          legendgrouptitle: {text: 'Monthly Status Categories'},
        },
        {
          x: months.concat(...months.toReversed()),
          y: monthlyStatusValues['Dry'].concat(monthlyStatusValues['Very Dry'].toReversed()),
          mode: 'lines',
          fill: 'toself',
          name: 'Dry',
          line: {width: 0},
          fillcolor: monthlyStatusColors['Dry'],
          legendgroup: 'Monthly Status Categories',
          legendgrouptitle: {text: 'Monthly Status Categories'},
        },
        {
          x: months.concat(...months.toReversed()),
          y: monthlyStatusValues['Very Dry'].concat(Array.from({length: 12}).fill(0)),
          mode: 'lines',
          fill: 'toself',
          name: 'Very Dry',
          line: {width: 0},
          fillcolor: monthlyStatusColors['Very Dry'],
          legendgroup: 'Monthly Status Categories',
          legendgrouptitle: {text: 'Monthly Status Categories'},
        },
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

  const getForecastData = riverid => {
    river.id = riverid ? riverid : river.id
    if (!river.id) return
    updateStatusIcons({forecast: "load"})
    chartForecast.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    Promise
      .all([fetchForecastPromise(river.id), fetchReturnPeriodsPromise(river.id)])
      .then(responses => {
        river.forecast = responses[0]
        river.returnPeriods = responses[1]
        plotForecast({forecast: responses[0], rp: responses[1], riverid: river.id})
        updateStatusIcons({forecast: "ready"})
      })
      .catch(() => {
        updateStatusIcons({forecast: "fail"})
      })
  }
  const getRetrospectiveData = () => {
    if (!river.id) return
    updateStatusIcons({retro: "load"})
    chartRetro.innerHTML = `<img alt="loading signal" src=${LOADING_GIF}>`
    fetchRetroPromise(river.id)
      .then(response => {
        river.retro = response
        plotRetroReport()
        updateStatusIcons({retro: "ready"})
      })
      .catch(() => {
        updateStatusIcons({retro: "fail"})
      })
  }
  const fetchData = ({riverid, referrer = null}) => {
    river.id = riverid ? riverid : river.id
    if (!river.id) return updateStatusIcons({riverid: "fail"})
    updateStatusIcons({riverid: "ready", forecast: "clear", retro: "clear"})
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
    river.id = parseInt(prompt(text.prompts.enterRiverID))
    if (!river.id) return
    if (!/^\d{9}$/.test(river.id)) return alert(text.prompts.invalidRiverID)
    fetchData({riverid: river.id, referrer: referrer})
  }

//////////////////////////////////////////////////////////////////////// Update
  const updateStatusIcons = status => {
    for (let key in status) {
      loadingStatus[key] = status[key]
    }
    const statusMessage = ['riverid', 'forecast', 'retro']
      .map(key => {
        let message = ''
        if (key === 'riverid' && loadingStatus[key] === "clear") message = text.inputs.enterRiverId
        switch (loadingStatus[key]) {
          case "load":
            message = text.status.load;
            break
          case "ready":
            message = key === "riverid" ? river.id : text.status.ready;
            break;
          case "fail":
            message = text.status.fail;
            break
        }
        message = message ? `${text.words[key]}: ${message}` : `${text.words[key]}`
        const modalFunction = key === "forecast" ? "showForecastModal()" : key === "retro" ? "showRetroModal()" : "setRiverId()";
        return `<button class="btn-flat status-btn status-${loadingStatus[key]}" onclick="${modalFunction}">${message}</button>`;
      })
      .join('');
    loadStatusDivs.forEach(el => el.innerHTML = statusMessage)
  }
  const clearChartDivs = (chartTypes) => {
    if (chartTypes === "forecast" || chartTypes === null) {
      chartForecast.innerHTML = ""
    }
    if (chartTypes === "retrospective" || chartTypes === null) {
      chartRetro.innerHTML = ''
      chartYearlyVol.innerHTML = ''
      chartYearlyStatus.innerHTML = ''
      chartMonthlyAvg.innerHTML = ''
      chartFdc.innerHTML = ''
    }
  }
  const updateDownloadLinks = type => {
    if (type === "clear") {
      document.getElementById("download-forecast-link").href = ""
      document.getElementById("download-retrospective-link").href = ""
      document.getElementById("download-forecast-btn").disabled = true
      document.getElementById("download-retrospective-btn").disabled = true
    } else if (type === "set") {
      document.getElementById("download-forecast-link").href = `${REST_ENDPOINT}/forecast/${river.id}`
      document.getElementById("download-retrospective-link").href = `${REST_ENDPOINT}/retrospective/${river.id}`
      document.getElementById("download-forecast-btn").disabled = false
      document.getElementById("download-retrospective-btn").disabled = false
    }
  }

//////////////////////////////////////////////////////////////////////// HASH UPDATES
  const updateHash = () => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    hashParams.set('lon', view.center.longitude.toFixed(2))
    hashParams.set('lat', view.center.latitude.toFixed(2))
    hashParams.set('zoom', view.zoom.toFixed(2))
    hashParams.set('definition', definitionExpression)
    window.location.hash = hashParams.toString()
  }
  const setHashDefinition = definition => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    hashParams.set('definition', definition)
    window.location.hash = hashParams.toString()
  }

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
  M.AutoInit()
  updateStatusIcons(JSON.parse(JSON.stringify(loadingStatus)))
  if (initialState.definition) updateLayerDefinitions(initialState.definition)
  if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 8000})
  // monthlyStatusLayer.urlTemplate = `https://rfs-v2.s3-us-west-2.amazonaws.com/map-tiles/hydrography/{level}/{col}/{row}.png`

//////////////////////////////////////////////////////////////////////// Event Listeners
  inputForecastDate.addEventListener("change", () => getForecastData())
  window.addEventListener('resize', () => {
    Plotly.Plots.resize(chartForecast)
    Plotly.Plots.resize(chartRetro)
  })
  view.on("click", event => {
    if (view.zoom < MIN_QUERY_ZOOM) return view.goTo({target: event.mapPoint, zoom: MIN_QUERY_ZOOM});
    M.toast({html: text.prompts.findingRiver, classes: "orange"})
    updateStatusIcons({riverid: "load", forecast: "clear", retro: "clear"})
    searchLayerByClickPromise(event)
      .then(response => {
        river.id = response.features[0].attributes.comid
        view.graphics.removeAll()
        view.graphics.add({
          geometry: response.features[0].geometry,
          symbol: {
            type: "simple-line",
            color: [0, 0, 255],
            width: 3
          }
        })
        fetchData({riverid: river.id, referrer: "forecast"})
      })
  })
  reactiveUtils.when(() => view.stationary === true, () => updateHash())

//////////////////////////////////////////////////////////////////////// Modal Functions
  const showForecastModal = () => {
    M.Modal.getInstance(modalForecasts).open()
    M.Modal.getInstance(modalRetro).close()
  }
  const showRetroModal = () => {
    M.Modal.getInstance(modalForecasts).close()
    M.Modal.getInstance(modalRetro).open()
  }

//////////////////////////////////////////////////////////////////////// Export alternatives
  window.setRiverId = setRiverId
  window.getForecastData = getForecastData
  window.getRetrospectiveData = getRetrospectiveData
  window.updateLayerDefinitions = updateLayerDefinitions
  window.resetDefinitionExpression = resetDefinitionExpression
  window.showForecastModal = showForecastModal
  window.showRetroModal = showRetroModal
  window.layer = rfsLayer
})
