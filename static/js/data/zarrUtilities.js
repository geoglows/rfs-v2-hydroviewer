import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita@0.5.4/+esm"

const _fetchDischarge = async ({zarrUrl, idx}) => {
  const qStore = new zarr.FetchStore(`${zarrUrl}/Q`);
  const qNode = await zarr.open(qStore, {mode: "r", format: 2});
  const discharge = await zarr.get(qNode, [null, idx]);
  return [...discharge.data];
}
const _fetchForecastDischarge = async ({zarrUrl, idx}) => {
  const nEnsMems = 51
  const qStore = new zarr.FetchStore(`${zarrUrl}/Qout`);
  const qNode = await zarr.open(qStore, {mode: "r", format: 2});
  const discharge = await zarr.get(qNode, [zarr.slice(0, nEnsMems), null, idx]);
  return [...discharge.data];
}
const _fetchReturnPeriods = async ({zarrUrl, idx}) => {
  const rpStore = new zarr.FetchStore(`${zarrUrl}/gumbel`);
  const rpNode = await zarr.open(rpStore, {mode: "r", format: 2});
  const returnPeriods = await zarr.get(rpNode, [null, idx]);
  return [...returnPeriods.data];
}
const fetchTimeCoordinate = async (zarrUrl) => {
  const tStore = new zarr.FetchStore(`${zarrUrl}/time`);
  const tNode = await zarr.open(tStore, {mode: "r", format: 2});

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
    return origin;
  });
}
const fetchCoordinateVariable = async ({zarrUrl, varName, zarrVersion = 2}) => {
  const store = new zarr.FetchStore(`${zarrUrl}/${varName}`);
  const node = await zarr.open(store, {mode: "r", format: zarrVersion});
  return await zarr.get(node, [null]);
}

export {
  _fetchDischarge,
  _fetchForecastDischarge,
  _fetchReturnPeriods,
  fetchCoordinateVariable,
  fetchTimeCoordinate,
}
