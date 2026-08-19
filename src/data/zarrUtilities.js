import {FetchStore, open, get} from "zarrita";

const _fetchDischarge = async ({zarrUrl, idx}) => {
  const qStore = new FetchStore(`${zarrUrl}/Q`);
  const qNode = await open.v2(qStore);
  const discharge = await get(qNode, [null, idx]);
  return [...discharge.data];
}
const _fetchForecastDischarge = async ({zarrUrl, idx}) => {
  const qStore = new FetchStore(`${zarrUrl}/Qout`);
  const qNode = await open.v2(qStore);
  const discharge = await get(qNode, [{start: 0, stop: 51, step: 1}, null, idx]);
  return [...discharge.data];
}
const _fetchReturnPeriods = async ({zarrUrl, idx}) => {
  const rpStore = new FetchStore(`${zarrUrl}/gumbel`);
  const rpNode = await open.v2(rpStore);
  const returnPeriods = await get(rpNode, [null, idx]);
  return [...returnPeriods.data];
}
const fetchTimeCoordinate = async (zarrUrl) => {
  const tStore = new FetchStore(`${zarrUrl}/time`);
  const tNode = await open.v2(tStore);

  const tUnits = tNode.attrs.units;
  const tArray = await get(tNode, [null]);
  // CF convention units look like "hours since 1940-01-01 00:00:00" with no timezone,
  // and are always UTC by convention. Force UTC parsing here or `new Date(...)` would
  // interpret this space-separated string in the browser's local timezone.
  const originTime = new Date(`${tUnits.split("since")[1].trim().replace(" ", "T")}Z`);
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
const fetchCoordinateVariable = async ({zarrUrl, varName}) => {
  const store = new FetchStore(`${zarrUrl}/${varName}`);
  const node = await open.v2(store);
  return await get(node, [null]);
}

export {
  _fetchDischarge,
  _fetchForecastDischarge,
  _fetchReturnPeriods,
  fetchCoordinateVariable,
  fetchTimeCoordinate,
}
