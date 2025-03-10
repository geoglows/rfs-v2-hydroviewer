import {loadStatusManager, updateHash, resetFilterForm, buildFilterExpression, showModal, lang} from "./ui.js";
import {plotAllForecast, plotAllRetro, clearCharts} from "./plots.js";
import {fetchForecastPromise, fetchReturnPeriodsPromise, fetchRetroPromise, updateDownloadLinks} from "./data.js";

require(
  ["esri/layers/MapImageLayer", "esri/layers/ImageryLayer", "esri/layers/TileLayer", "esri/layers/WebTileLayer", "esri/layers/FeatureLayer", "esri/widgets/TimeSlider", "esri/core/reactiveUtils", "esri/intl", "esri/config"],
  (MapImageLayer, ImageryLayer, TileLayer, WebTileLayer, FeatureLayer, TimeSlider, reactiveUtils, intl, config) => {
    document.querySelector('arcgis-map').addEventListener('arcgisViewReadyChange', () => {
      //////////////////////////////////////////////////////////////////////// Constants and Elements
      const RFS_LAYER_URL = 'https://livefeeds3.arcgis.com/arcgis/rest/services/GEOGLOWS/GlobalWaterModel_Medium/MapServer'
      const MIN_QUERY_ZOOM = 11

      // manipulated elements
      const inputForecastDate = document.getElementById('forecast-date-calendar')
      const timeSliderForecastDiv = document.getElementById('timeSliderForecast')
      const timeSliderStatusDiv = document.getElementById('timeSliderStatus')
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
      filterButton.className = "esri-widget--button esri-widget esri-interactive";
      filterButton.innerHTML = `<span class="esri-icon-filter"></span>`;
      filterButton.addEventListener('click', () => M.Modal.getInstance(modalFilter).open());

      const timeSliderButton = document.createElement('div');
      timeSliderButton.className = "esri-widget--button esri-widget esri-interactive";
      timeSliderButton.innerHTML = `<span class="esri-icon-time-clock"></span>`;
      timeSliderButton.addEventListener('click', () => timeSliderForecastDiv.classList.toggle('show-slider'))

      const timeSliderButton2 = document.createElement('div');
      timeSliderButton2.className = "esri-widget--button esri-widget esri-interactive";
      timeSliderButton2.innerHTML = `<span class="esri-icon-time-clock"></span>`;
      timeSliderButton2.addEventListener('click', () => timeSliderStatusDiv.classList.toggle('show-slider'))

      const timeSliderForecast = new TimeSlider({
        container: "timeSlider",
        view: view,
        playRate: 1250,
        loop: true,
        expanded: false,
        mode: "instant",
      });
      const timeSliderStatus = new TimeSlider({
        container: "timeSlider2",
        playRate: 1250,
        loop: true,
        expanded: false,
        mode: "instant",
        fullTimeExtent: {
          start: new Date(2025, 0, 1),
          end: new Date(2025, 2, 1)
        },
        stops: {
          interval: {
            value: 1,
            unit: "months"
          }
        }
      });

      view.navigation.browserTouchPanEnabled = true;
      view.ui.add(filterButton, "top-left");
      view.ui.add(timeSliderButton, "top-left");
      view.ui.add(timeSliderButton2, "top-left");

      const rfsLayer = new MapImageLayer({
        url: RFS_LAYER_URL,
        title: "GEOGLOWS River Forecast System v2",
        sublayers: [{id: 0, definitionExpression}]
      })
      const monthlyStatusLayer = new WebTileLayer({
        urlTemplate: `https://rfs-v2.s3-us-west-2.amazonaws.com/map-tiles/basin-status/2025-01/{level}/{col}/{row}.png`,
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

      view.whenLayerView(rfsLayer.findSublayerById(0).layer).then(_ => {
        timeSliderForecast.fullTimeExtent = rfsLayer.findSublayerById(0).layer.timeInfo.fullTimeExtent.expandTo("hours");
        timeSliderForecast.stops = {interval: rfsLayer.findSublayerById(0).layer.timeInfo.interval}
      })

      reactiveUtils.watch(() => timeSliderStatus.timeExtent, () => monthlyStatusLayer.refresh())
      monthlyStatusLayer.getTileUrl = (level, row, col) => {
        return `https://rfs-v2.s3-us-west-2.amazonaws.com/map-tiles/basin-status/${timeSliderStatus.timeExtent.start.toISOString().slice(0, 7)}/{level}/{col}/{row}.png`
          .replace("{level}", level)
          .replace("{col}", col)
          .replace("{row}", row)
      }

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
            plotAllForecast({forecast: responses[0], rp: responses[1], riverid: riverId})
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
          .catch(() => {
            loadStatus.update({retro: "fail"})
          })
      }
      const fetchData = ({riverid, referrer = null}) => {
        riverId = riverid ? riverid : riverId
        if (!riverId) return loadStatus.update({riverid: "fail"})
        loadStatus.update({riverid: riverId, forecast: "clear", retro: "clear"})
        clearCharts()
        updateDownloadLinks(riverId)
        if (referrer) showModal(referrer)
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
      if (window.innerWidth < 800) M.toast({html: text.prompts.mobile, classes: "blue custom-toast-placement", displayLength: 7500})
      inputForecastDate.addEventListener("change", () => getForecastData())

//////////////////////////////////////////////////////////////////////// Export alternatives
      window.setRiverId = setRiverId
      window.getForecastData = getForecastData
      window.getRetrospectiveData = getRetrospectiveData
      window.updateLayerDefinitions = updateLayerDefinitions
      window.resetDefinitionExpression = resetDefinitionExpression
    })
  })
