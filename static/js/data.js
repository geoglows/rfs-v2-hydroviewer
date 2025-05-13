const REST_ENDPOINT = 'https://geoglows.ecmwf.int/api/v2'
import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita/+esm";

const baseZarrUrl = "http://geoglows-v2.s3-us-west-2.amazonaws.com/retrospective"

const useBC = () => document.getElementById('useBC').checked

const fetchForecastPromise = ({riverid, date}) => {
  return new Promise((resolve, reject) => {
    fetch(`${REST_ENDPOINT}/forecast/${riverid}/?format=json&date=${date}&bias_corrected=${useBC()}`)
      .then(response => resolve(response))
      .catch(() => reject())
  })
}
const fetchReturnPeriodsPromise = async (riverid) => {
  const url = `${baseZarrUrl}/return-periods.zarr`
  const idx = await fetchRiverIndexForS3Zarr(url, riverid)

  // open the return periods variable
  const rpLabelStore = new zarr.FetchStore(`${url}/return_period`);
  const rpLabelNode = await zarr.open(rpLabelStore, {mode: "r", format: 2});
  const rpLabels = await zarr.get(rpLabelNode, [null]);
  const rpStore = new zarr.FetchStore(`${url}/gumbel`);
  const rpNode = await zarr.open(rpStore, {mode: "r", format: 2});
  const rpArray = await zarr.get(rpNode, [null, idx])
  const rpDict = {}
  rpLabels.data.forEach((label, i) => {
    rpDict[label] = rpArray.data[i]
  })
  console.log("rpDict", rpDict)
  return rpDict
}
const fetchRetroPromise = async (riverid) => {
  await fetchReturnPeriodsPromise(riverid)
  const url = `${baseZarrUrl}/hourly.zarr`;
  const datetime = await fetchTimeForS3Zarr(url);
  const idx = await fetchRiverIndexForS3Zarr(url, riverid);

  const qStore = new zarr.FetchStore(`${url}/Q`);
  const qNode = await zarr.open(qStore, {mode: "r", format: 2});
  const discharge = await zarr.get(qNode, [null, idx])
  return {datetime, [riverid]: discharge.data}
}

const updateDownloadLinks = riverid => {
  const hrefForecast = riverid ? `${REST_ENDPOINT}/forecast/${riverid}` : ""
  const hrefRetro = riverid ? `${REST_ENDPOINT}/retrospective/${riverid}` : ""
  document.getElementById("download-forecast-link").href = hrefForecast
  document.getElementById("download-retrospective-link").href = hrefRetro
  document.getElementById("download-forecast-btn").disabled = !riverid
  document.getElementById("download-retrospective-btn").disabled = !riverid
}

const fetchTimeForS3Zarr = async (zarrUrl) => {
  // open the time variable
  const tStore = new zarr.FetchStore(`${zarrUrl}/time`);
  const tNode = await zarr.open(tStore, {mode: "r", format: 2});

  // get the time values and convert from "time since origin" values to ISO strings
  const tUnits = tNode.attrs.units;
  const tArray = await zarr.get(tNode, [null]);
  const originTime = new Date(tUnits.split("since")[1].trim());
  const conversionFactor = {
    seconds: 1,
    minutes: 60,
    hours: 60 * 60,
    days: 60 * 60 * 24,
  }[tUnits.split("since")[0].trim()];
  return [...tArray.data].map(t => {
    let origin = new Date(originTime);
    origin.setSeconds(origin.getSeconds() + (Number(t) * conversionFactor));
    return origin
  });
}

const fetchRiverIndexForS3Zarr = async (zarrUrl, riverid) => {
  // open the river_id variable
  const idStore = new zarr.FetchStore(`${zarrUrl}/river_id`);
  const idNode = await zarr.open(idStore, {mode: "r", format: 2});
  // determine the index of the river with your ID of interest
  const idArray = await zarr.get(idNode, [null]);
  const idx = idArray.data.indexOf(riverid);

  if (idx === -1) {
    return new Error(`River ID ${riverid} not found.`)
  }
  return idx
}

export {fetchForecastPromise, fetchReturnPeriodsPromise, fetchRetroPromise, updateDownloadLinks}