import {buildFilterExpression, hideRiverInput, lang, loadStatusManager, resetFilterForm, riverIdInput, riverIdInputContainer, showChartView, updateHash} from "./ui.js";
import {clearCharts, plotAllForecast, plotAllRetro} from "./plots.js";
import {fetchForecastMembersPromise, fetchForecastPromise, fetchRetroPromise, fetchReturnPeriodsPromise, updateDownloadLinks} from "./data.js";
import {useForecastMembers} from "./settings.js";

require(
  ["esri/layers/MapImageLayer", "esri/layers/ImageryLayer", "esri/layers/TileLayer", "esri/layers/WebTileLayer", "esri/layers/FeatureLayer", "esri/layers/ImageryTileLayer", "esri/widgets/TimeSlider", "esri/core/reactiveUtils", "esri/intl", "esri/config"],
  (MapImageLayer, ImageryLayer, TileLayer, WebTileLayer, FeatureLayer, ImageryTileLayer, TimeSlider, reactiveUtils, intl, config) => {
    document.querySelector('arcgis-map').addEventListener('arcgisViewReadyChange', () => {
      //////////////////////////////////////////////////////////////////////// Constants and Elements
      const RFS_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
      const MIN_QUERY_ZOOM = 11
      // manipulated elements
      const inputForecastDate = document.getElementById('forecast-date-calendar')
      const timeSliderForecastDiv = document.getElementById('timeSliderForecastWrapper')
      const timeSliderFfiDiv = document.getElementById('timeSliderFfiWrapper')
      const timeSliderStatusDiv = document.getElementById('timeSliderHydroSOSWrapper')
      const riverName = document.getElementById('river-name')
      // modal elements
      const modalFilter = document.getElementById("filter-modal")

////////////////////////////////////////////////////////////////////////  Initial state and config
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const initLon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : 10
      const initLat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : 18
      const initZoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : 2.75
      let definitionExpression = hashParams.get('definition') || ""
      const loadStatus = loadStatusManager()
      let riverId = null
      Plotly.setPlotConfig({'locale': lang})
      intl.setLocale(lang)
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
                loadStatus.update({riverid: null})
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

//////////////////////////////////////////////////////////////////////// Layer Filtering and Events
      const updateLayerDefinitions = string => {
        definitionExpression = string || buildFilterExpression()
        rfsLayer.findSublayerById(0).definitionExpression = definitionExpression
        M.Modal.getInstance(modalFilter).close()
        updateHash({definition: definitionExpression})
      }
      const resetDefinitionExpression = () => {
        definitionExpression = ""
        resetFilterForm()
        updateLayerDefinitions("")
        updateHash({definition: definitionExpression})
      }

//////////////////////////////////////////////////////////////////////// Create map, view, layers, and map events
      const mapContainer = document.querySelector('arcgis-map')
      const map = mapContainer.map
      const view = mapContainer.view
      view.zoom = initZoom
      view.center = [initLon, initLat]
      view.constraints = {
        rotationEnabled: false,
        snapToZoom: false,
        minZoom: 2,
      }

      const filterButton = document.createElement('div');
      filterButton.setAttribute("title", 'Filter Visible Streams');
      filterButton.className = "esri-widget--button esri-widget esri-interactive";
      filterButton.innerHTML = `<span class="esri-icon-filter"></span>`;
      filterButton.addEventListener('click', () => M.Modal.getInstance(modalFilter).open());

      const timeSliderForecastButton = document.createElement('div');
      timeSliderForecastButton.setAttribute("title", 'Forecast Layer Time steps');
      timeSliderForecastButton.className = "esri-widget--button esri-widget esri-interactive";
      timeSliderForecastButton.innerHTML = `<span class="esri-icon-time-clock"></span>`;
      timeSliderForecastButton.addEventListener('click', () => {
        timeSliderForecastDiv.classList.toggle('show-slider')
        timeSliderFfiDiv.classList.remove('show-slider')
        timeSliderStatusDiv.classList.remove('show-slider')
      })

      const timeSliderFfiButton = document.createElement('div');
      timeSliderFfiButton.setAttribute("title", 'RFS v2 Flash Flood Indicators Time steps');
      timeSliderFfiButton.className = "esri-widget--button esri-widget esri-interactive";
      timeSliderFfiButton.innerHTML = `FFI`;
      timeSliderFfiButton.addEventListener('click', () => {
        timeSliderForecastDiv.classList.remove('show-slider')
        timeSliderFfiDiv.classList.toggle('show-slider')
        timeSliderStatusDiv.classList.remove('show-slider')
      })

      const timeSliderHydroSOSButton = document.createElement('div');
      timeSliderHydroSOSButton.setAttribute("title", 'Monthly Status Layer Time steps');
      timeSliderHydroSOSButton.className = "esri-widget--button esri-widget esri-interactive";
      timeSliderHydroSOSButton.innerHTML = `SOS`;
      timeSliderHydroSOSButton.addEventListener('click', () => {
        timeSliderForecastDiv.classList.remove('show-slider')
        timeSliderFfiDiv.classList.remove('show-slider')
        timeSliderStatusDiv.classList.toggle('show-slider')
      })

      const timeSliderForecast = new TimeSlider({
        container: "timeSliderForecast",
        view: view,
        playRate: 1250,
        loop: true,
        label: "Forecast Layer Time Steps",
        mode: "instant",
      });
      const timeSliderFfi = new TimeSlider({
        container: "timeSliderFfi",
        playRate: 1250,
        loop: true,
        label: "RFS v2 Flash Flood Indicators Time Steps",
        mode: "instant",
        queryParameters: {intercept: true},
      })
      const timeSliderStatus = new TimeSlider({
        container: "timeSliderHydroSOS",
        playRate: 3000,
        loop: true,
        label: "HydroSOS Monthly Status Layer Time Steps",
        mode: "instant",
        fullTimeExtent: {
          start: new Date(1990, 0, 1),
          end: new Date(now.getFullYear(), now.getMonth() - (now.getDate() > 6 ? 1 : 2), 1)
        },
        stops: {
          interval: {
            value: 1,
            unit: "months"
          }
        }
      });
      timeSliderStatus.when(() => timeSliderStatus.previous())  // once the slider is ready go to the most recent time (end) not earliest (start)

      view.navigation.browserTouchPanEnabled = true;
      view.ui.add(filterButton, "top-left");
      view.ui.add(timeSliderForecastButton, "top-left");
      view.ui.add(timeSliderFfiButton, "top-left");
      view.ui.add(timeSliderHydroSOSButton, "top-left");

      const rfsLayer = new MapImageLayer({
        url: RFS_LAYER_URL,
        title: "GEOGLOWS River Forecast System v2",
        sublayers: [{id: 0, definitionExpression}]
      })
      const rfsFfi = new MapImageLayer({
        url: 'customflashfloodlogic',
        title: "RFS v2 Flash Flood Indicators (Beta)",
        sublayers: [{id: 0, definitionExpression: 'returnperiod > 1'}],
        visible: false,
      })
      let cogMonthlyStatusLayer = new ImageryTileLayer({
        url: "https://d2sl0kux8qc7kl.cloudfront.net/hydrosos/cogs/2025-07.tif",
        title: "HydroSOS Monthly Status Indicators",
        visible: false,
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
      map.addMany([goesImageryColorized, viirsThermalAnomalies, viirsTrueColor, viirsWaterStates, viirsFloodClassified, rfsFfi, cogMonthlyStatusLayer, rfsLayer])

      // handle interactions with the rfs layer
      view.whenLayerView(rfsLayer.findSublayerById(0).layer).then(_ => {
        timeSliderForecast.fullTimeExtent = rfsLayer.findSublayerById(0).layer.timeInfo.fullTimeExtent.expandTo("hours");
        timeSliderForecast.stops = {interval: rfsLayer.findSublayerById(0).layer.timeInfo.interval}
      })

      // handle interactions with the flash flood indicators layer
      view.whenLayerView(rfsFfi.findSublayerById(0).layer).then(_ => {
        timeSliderFfi.fullTimeExtent = {
          start: rfsFfi.findSublayerById(0).layer.timeInfo.fullTimeExtent.start,
          end: new Date(rfsFfi.findSublayerById(0).layer.timeInfo.fullTimeExtent.start.getTime() + 72 * 60 * 60 * 1000) // 72 hours later
        }
        timeSliderFfi.stops = {interval: rfsFfi.findSublayerById(0).layer.timeInfo.interval}
      })
      reactiveUtils.watch(() => timeSliderFfi.timeExtent, () => rfsFfi.refresh())
      config.request.interceptors.push({
        urls: /customflashfloodlogic/,
        before: params => {
          params.url = params.requestOptions.query.bbox ? `${RFS_LAYER_URL}/export` : `${RFS_LAYER_URL}`
          params.requestOptions.query.time = timeSliderFfi?.timeExtent?.start?.getTime() || null
          delete params.requestOptions.query._ts
        }
      })
      reactiveUtils.watch(() => rfsFfi.visible, visible => {
        rfsLayer.visible = !visible
        timeSliderFfiDiv.classList.toggle('show-slider', visible)
        if (visible) {
          timeSliderForecastDiv.classList.remove('show-slider')
          timeSliderStatusDiv.classList.remove('show-slider')
        }
      })

      // handle interactions with the monthly status tile layer
      reactiveUtils.watch(() => timeSliderStatus.timeExtent, () => {
        const year = timeSliderStatus.timeExtent.start.toISOString().slice(0, 4)
        const month = timeSliderStatus.timeExtent.start.toISOString().slice(5, 7)
        const layerPickerIndex = map.layers.indexOf(cogMonthlyStatusLayer)
        const layerWasVisible = cogMonthlyStatusLayer.visible
        // todo: delete/recreate causes an error when changing dates quickly but you can't edit the url and trigger a re-load
        map.remove(cogMonthlyStatusLayer)
        cogMonthlyStatusLayer = new ImageryTileLayer({
          url: `https://d2sl0kux8qc7kl.cloudfront.net/hydrosos/cogs/${year}-${month}.tif`,
          title: "HydroSOS Monthly Status Indicators",
          visible: layerWasVisible,
        })
        map.add(cogMonthlyStatusLayer, layerPickerIndex)
      })

      // update the url hash with the view location but only when the view is finished changing, not every interval of the active changes
      reactiveUtils
        .when(
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
            view.graphics.removeAll()
            view.graphics.add({
              geometry: response.features[0].geometry,
              symbol: {
                type: "simple-line",
                color: [0, 0, 255],
                width: 3
              }
            })
            showChartView('forecast')
            fetchData({riverid: response.features[0].attributes.comid})
          })
      })

//////////////////////////////////////////////////////////////////////// GET DATA FROM API AND MANAGING PLOTS
      const getForecastData = riverid => {
        riverId = riverid ? riverid : riverId
        if (!riverId) return
        loadStatus.update({forecast: "load"})
        const date = inputForecastDate.value.replaceAll("-", "")
        const showMembers = useForecastMembers()
        const forecastFetcher = showMembers ? fetchForecastMembersPromise : fetchForecastPromise
        Promise
          .all([forecastFetcher({riverid: riverId, date}), fetchReturnPeriodsPromise(riverId)])
          .then(responses => {
            plotAllForecast({forecast: responses[0], rp: responses[1], riverid: riverId, showMembers})
            loadStatus.update({forecast: "ready"})
          })
          .catch(() => {
            loadStatus.update({forecast: "fail"})
          })
      }
      const getRetrospectiveData = () => {
        if (!riverId) return
        clearCharts('retrospective')
        loadStatus.update({retro: "load"})
        fetchRetroPromise(riverId)
          .then(response => {
            plotAllRetro({retro: response, riverid: riverId})
            loadStatus.update({retro: "ready"})
          })
          .catch(() => loadStatus.update({retro: "fail"}))
      }
      const fetchData = ({riverid}) => {
        riverId = riverid ? riverid : riverId
        if (!riverId) return loadStatus.update({riverid: null})
        clearCharts()
        loadStatus.update({riverid: riverId, forecast: "clear", retro: "clear"})
        updateDownloadLinks(riverId)
        getForecastData()
        getRetrospectiveData()
      }
      const setRiverId = id => {
        if (!id) {
          let possibleId = riverIdInput.value
          if (!/^\d{9}$/.test(possibleId)) return alert(text.prompts.invalidRiverID)
          id = possibleId
        }
        riverId = id
        fetchData({riverid: riverId})
      }

//////////////////////////////////////////////////////////////////////// INITIAL LOAD
      M.AutoInit()
      loadStatus.update()
      if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 7500})
      inputForecastDate.addEventListener("change", () => getForecastData())
      riverIdInput.addEventListener("keydown", event => {
        if (event.key !== "Enter") return
        let possibleId = riverIdInput.value
        if (!riverIdInputContainer.classList.contains("hide") && /^\d{9}$/.test(possibleId)) {
          hideRiverInput()
          setRiverId(possibleId)
        } else alert(text.prompts.invalidRiverID)
      })

//////////////////////////////////////////////////////////////////////// Export alternatives
      window.setRiverId = setRiverId
      window.getForecastData = getForecastData
      window.getRetrospectiveData = getRetrospectiveData
      window.updateLayerDefinitions = updateLayerDefinitions
      window.resetDefinitionExpression = resetDefinitionExpression
    })
  })
