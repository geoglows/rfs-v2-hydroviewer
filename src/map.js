import "@arcgis/core/assets/esri/themes/light/main.css";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-zoom";
import "@arcgis/map-components/components/arcgis-layer-list";
import "@arcgis/map-components/components/arcgis-locate";
import "@arcgis/map-components/components/arcgis-scale-bar";
import "@arcgis/map-components/components/arcgis-expand";
import "@arcgis/map-components/components/arcgis-basemap-gallery";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-time-slider";
import "@esri/calcite-components/components/calcite-action";

import MapImageLayer from "@arcgis/core/layers/MapImageLayer";
import ImageryLayer from "@arcgis/core/layers/ImageryLayer";
import TileLayer from "@arcgis/core/layers/TileLayer";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import ImageryTileLayer from "@arcgis/core/layers/ImageryTileLayer";
import TimeSlider from "@arcgis/core/widgets/TimeSlider";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import * as intl from "@arcgis/core/intl";

import {buildFilterExpression, inputForecastDate, modalFilter, resetFilterForm, RFS_LAYER_URL, selectOutletCountry, selectRiverCountry, selectVPU, showChartView, updateHash,} from "./ui.js";
import {Lang, LoadStatus, RiverId} from "./states/state.js";
import riverCountries from "./json/riverCountries.json" with {type: "json"};
import outletCountries from "./json/outletCountries.json" with {type: "json"};
import vpuList from "./json/vpuList.json" with {type: "json"};
import {translationDictionary} from "./intl.js";

const MIN_QUERY_ZOOM = 11
export const mapElement = document.querySelector('arcgis-map')
export const timeSliderForecastDiv = document.getElementById('timeSliderForecastWrapper')
export const timeSliderStatusDiv = document.getElementById('timeSliderHydroSOSWrapper')
const filterButton = document.querySelector('calcite-action#filter-button')
const timeSliderForecastButton = document.querySelector('calcite-action#forecast-time-slider')
const timeSliderHydroSOSButton = document.querySelector('calcite-action#hydrosos-time-slider')

export default function main() {
  ////////////////////////////////////////////////////////////////////////  Initial state and config
  const hashParams = new URLSearchParams(window.location.hash.slice(1))
  const initLon = !isNaN(parseFloat(hashParams.get('lon'))) ? parseFloat(hashParams.get('lon')) : 10
  const initLat = !isNaN(parseFloat(hashParams.get('lat'))) ? parseFloat(hashParams.get('lat')) : 18
  const initZoom = !isNaN(parseFloat(hashParams.get('zoom'))) ? parseFloat(hashParams.get('zoom')) : 2.75
  let definitionExpression = hashParams.get('definition') || ""
  intl.setLocale(Lang.get())

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
            M.toast({html: translationDictionary.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
            return reject()
          }
          if (response.features[0].attributes.comid === "Null" || !response.features[0].attributes.comid) {
            RiverId.reset()
            LoadStatus.reset()
            M.toast({html: translationDictionary.prompts.tryRiverAgain, classes: "red", displayDuration: 5000})
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
  const map = mapElement.map
  const view = mapElement.view
  view.zoom = initZoom
  view.center = [initLon, initLat]
  view.constraints = {
    rotationEnabled: false,
    snapToZoom: false,
    minZoom: 2,
  }

  const timeSliderForecast = new TimeSlider({
    container: "timeSliderForecast",
    view: view,
    playRate: 1250,
    loop: true,
    label: "Forecast Layer Time Steps",
    mode: "instant",
  });
  const timeSliderHydroSOS = new TimeSlider({
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
  timeSliderHydroSOS.when(() => timeSliderHydroSOS.previous())  // once the slider is ready go to the most recent time. starts at 0, previous is -1/last index

  view.navigation.browserTouchPanEnabled = true;

  const rfsLayer = new MapImageLayer({
    url: RFS_LAYER_URL,
    title: "GEOGLOWS River Forecast System v2",
    sublayers: [{id: 0, definitionExpression}]
  })
  let cogMonthlyStatusLayer = new ImageryTileLayer({
    url: `https://d2sl0kux8qc7kl.cloudfront.net/hydrosos/cogs/${lastHydroSOSDate.getFullYear()}-${String(lastHydroSOSDate.getMonth() + 1).padStart(2, '0')}.tif`,
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
  reactiveUtils.watch(() => timeSliderHydroSOS.timeExtent, () => {
    const year = timeSliderHydroSOS.timeExtent.start.toISOString().slice(0, 4)
    const month = timeSliderHydroSOS.timeExtent.start.toISOString().slice(5, 7)
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
    M.toast({html: translationDictionary.prompts.findingRiver, classes: "orange"})
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
}

mapElement.addEventListener('arcgisViewReadyChange', () => main())

filterButton.addEventListener('click', () => {
  M.Modal.getInstance(modalFilter).open()
})
timeSliderForecastButton.addEventListener('click', () => {
  timeSliderForecastDiv.classList.toggle('show-slider')
  timeSliderStatusDiv.classList.remove('show-slider')
})
timeSliderHydroSOSButton.addEventListener('click', () => {
  timeSliderForecastDiv.classList.remove('show-slider')
  timeSliderStatusDiv.classList.toggle('show-slider')
})
selectRiverCountry.innerHTML += riverCountries.map(c => `<option value="${c}">${c}</option>`).join('')
selectOutletCountry.innerHTML += outletCountries.map(c => `<option value="${c}">${c}</option>`).join('')
selectVPU.innerHTML += vpuList.map(v => `<option value="${v}">${v}</option>`).join('')
M.FormSelect.init(selectRiverCountry)
M.FormSelect.init(selectOutletCountry)
M.FormSelect.init(selectVPU)
