import {buildFilterExpression, inputForecastDate, lang, modalFilter, resetFilterForm, RFS_LAYER_URL, selectOutletCountry, selectRiverCountry, selectVPU, showChartView, updateHash,} from "./ui.js";
import {LoadStatus, RiverId} from "./states/state.js";
import riverCountries from "/static/json/riverCountries.json" with {type: "json"};
import outletCountries from "/static/json/outletCountries.json" with {type: "json"};
import vpuList from "/static/json/vpuList.json" with {type: "json"};

const timeSliderForecastDiv = document.getElementById('timeSliderForecastWrapper')
const timeSliderStatusDiv = document.getElementById('timeSliderHydroSOSWrapper')

selectRiverCountry.innerHTML += riverCountries.map(c => `<option value="${c}">${c}</option>`).join('')
selectOutletCountry.innerHTML += outletCountries.map(c => `<option value="${c}">${c}</option>`).join('')
selectVPU.innerHTML += vpuList.map(v => `<option value="${v}">${v}</option>`).join('')
M.FormSelect.init(selectRiverCountry)
M.FormSelect.init(selectOutletCountry)
M.FormSelect.init(selectVPU)

require(
  ["esri/layers/MapImageLayer", "esri/layers/ImageryLayer", "esri/layers/TileLayer", "esri/layers/WebTileLayer", "esri/layers/FeatureLayer", "esri/layers/ImageryTileLayer", "esri/widgets/TimeSlider", "esri/core/reactiveUtils", "esri/intl", "esri/config"],
  (MapImageLayer, ImageryLayer, TileLayer, WebTileLayer, FeatureLayer, ImageryTileLayer, TimeSlider, reactiveUtils, intl, config) => {
    document.querySelector('arcgis-map').addEventListener('arcgisViewReadyChange', () => {
      //////////////////////////////////////////////////////////////////////// Constants and Elements
      const MIN_QUERY_ZOOM = 11

////////////////////////////////////////////////////////////////////////  Initial state and config
      const hashParams = new URLSearchParams(window.location.hash.slice(1))
      const initLon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : 10
      const initLat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : 18
      const initZoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : 2.75
      let definitionExpression = hashParams.get('definition') || ""
      intl.setLocale(lang)

      const now = new Date()  // the default date is 12 hours before UTC now, typical lag for computing forecasts each day
      const firstHydroSOSDate = new Date(1990, 0, 1)  // July 2024
      const lastHydroSOSDate = new Date(now.getFullYear(), now.getMonth() - (now.getDate() > 6 ? 1 : 2), 1)
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
                RiverId.reset()
                LoadStatus.reset()
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
        timeSliderStatusDiv.classList.remove('show-slider')
      })

      const timeSliderHydroSOSButton = document.createElement('div');
      timeSliderHydroSOSButton.setAttribute("title", 'Monthly Status Layer Time steps');
      timeSliderHydroSOSButton.className = "esri-widget--button esri-widget esri-interactive";
      timeSliderHydroSOSButton.innerHTML = `SOS`;
      timeSliderHydroSOSButton.addEventListener('click', () => {
        timeSliderForecastDiv.classList.remove('show-slider')
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
      const timeSliderStatus = new TimeSlider({
        container: "timeSliderHydroSOS",
        playRate: 3000,
        loop: true,
        label: "HydroSOS Monthly Status Layer Time Steps",
        mode: "instant",
        fullTimeExtent: {
          start: firstHydroSOSDate,
          end: lastHydroSOSDate
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
      view.ui.add(timeSliderHydroSOSButton, "top-left");

      const rfsLayer = new MapImageLayer({
        url: RFS_LAYER_URL,
        title: "GEOGLOWS River Forecast System v2",
        sublayers: [{id: 0, definitionExpression}]
      })
      let cogMonthlyStatusLayer = new ImageryTileLayer({
        url:`https://d2sl0kux8qc7kl.cloudfront.net/hydrosos/cogs/${lastHydroSOSDate.getFullYear()}-${String(lastHydroSOSDate.getMonth() + 1).padStart(2, '0')}.tif`,
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
      map.addMany([goesImageryColorized, viirsThermalAnomalies, viirsTrueColor, viirsWaterStates, viirsFloodClassified, cogMonthlyStatusLayer, rfsLayer])

      // handle interactions with the rfs layer
      view.whenLayerView(rfsLayer.findSublayerById(0).layer).then(_ => {
        timeSliderForecast.fullTimeExtent = rfsLayer.findSublayerById(0).layer.timeInfo.fullTimeExtent.expandTo("hours");
        timeSliderForecast.stops = {interval: rfsLayer.findSublayerById(0).layer.timeInfo.interval}
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
            RiverId.set(response.features[0].attributes.comid)
          })
      })

      window.updateLayerDefinitions = updateLayerDefinitions
      window.resetDefinitionExpression = resetDefinitionExpression
    })
  })
