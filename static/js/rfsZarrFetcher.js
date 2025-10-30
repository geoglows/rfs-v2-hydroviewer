/**
 Copyright 2025 Dr Riley Hales
 Redistribution and use in source and binary forms, with or without modification, are permitted (subject to the limitations in the disclaimer below) provided that the following conditions are met:
 * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * Neither the name of [Owner Organization] nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 NO EXPRESS OR IMPLIED LICENSES TO ANY PARTY'S PATENT RIGHTS ARE GRANTED BY THIS LICENSE. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 **/

import * as zarr from "https://cdn.jsdelivr.net/npm/zarrita@0.5.4/+esm"
// import * as zarr from "zarrita"

const baseRetroZarrUrl = "https://geoglows-v2.s3-us-west-2.amazonaws.com"
const baseForecastZarrUrl = "https://geoglows-v2-forecasts.s3-website-us-west-2.amazonaws.com"

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
const getIndexOfCoordinateValue = ({zarrArray, value}) => {
  const idx = zarrArray.data.indexOf(value);
  if (idx === -1) {
    throw new Error(`River ID ${riverId} not found.`)
  }
  return idx;
}
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

const fetchForecast = async ({riverId, date}) => {
  if (!/^\d{8}$/.test(date)) return Promise.reject(new Error(`Date '${date}' is not in the correct format YYYYMMDD.`));

  // get data from zarr
  const zarrUrl = `${baseForecastZarrUrl}/${date}00.zarr`;
  const riverIds = await fetchCoordinateVariable({zarrUrl, varName: 'rivid'});
  const idx = getIndexOfCoordinateValue({zarrArray: riverIds, value: riverId});
  if (idx === -1) return Promise.reject(new Error(`River ID ${riverId} not found.`));
  const nEnsMems = 51;
  let [datetime, discharge] = await Promise.all([fetchTimeCoordinate(zarrUrl), _fetchForecastDischarge({zarrUrl, idx, varName: 'Qout'})])
  // discharge has shape of [nEnsMems, datetime.length] but it's flattened. find out which discharges are nan in the first ensemble member for reference in filtering the rest
  const validTimeIndices = discharge.slice(0, datetime.length).map((val, i) => !isNaN(val) ? i : -1).filter(i => i !== -1);
  // split the discharge array into the correct number of subarrays
  const memberStartIndices = Array(nEnsMems).fill(0).map((_, i) => i * datetime.length);
  discharge = memberStartIndices
    .map(startIdx => discharge.slice(startIdx, startIdx + datetime.length))  // array of nEnsMems subarrays
    .map(memberArray => validTimeIndices.map(i => memberArray[i]))  // for each member array, select only the valid time indices
  datetime = validTimeIndices.map(i => datetime[i]);
  const stats = membersToStats(discharge)

  return Promise.resolve({datetime, discharge, stats});
}

const fetchRetro = async ({riverId, resolution = "daily"}) => {
  const recognizedResolutions = ['hourly', 'daily', 'monthly', 'yearly', 'maximums'];
  if (!recognizedResolutions.includes(resolution)) return Promise.reject(new Error(`Resolution '${resolution}' is not recognized.`));

  // get data from zarr
  const zarrUrl = `${baseRetroZarrUrl}/retrospective/${resolution}.zarr`;
  const riverIds = await fetchCoordinateVariable({zarrUrl, varName: 'river_id'});
  const idx = getIndexOfCoordinateValue({zarrArray: riverIds, value: riverId});
  if (idx === -1) return Promise.reject(new Error(`River ID ${riverId} not found.`));
  const [datetime, discharge] = await Promise.all([fetchTimeCoordinate(zarrUrl), _fetchDischarge({zarrUrl, idx, varName: 'Q'})])

  return Promise.resolve({datetime, discharge});
}

const fetchReturnPeriods = async ({riverId}) => {
  const zarrUrl = `${baseRetroZarrUrl}/retrospective/return-periods.zarr`;
  const riverIds = await fetchCoordinateVariable({zarrUrl, varName: 'river_id'});
  const idx = getIndexOfCoordinateValue({zarrArray: riverIds, value: riverId});
  if (idx === -1) return Promise.reject(new Error(`River ID ${riverId} not found.`));

  const returnPeriodLabels = await fetchCoordinateVariable({zarrUrl, varName: 'return_period'});
  const rpStore = new zarr.FetchStore(`${zarrUrl}/gumbel`);
  const rpNode = await zarr.open(rpStore, {mode: "r", format: 2});
  const returnPeriods = await zarr.get(rpNode, [null, idx]);

  // make an object mapping return period labels to their corresponding discharge values
  const rpData = {}
  returnPeriodLabels.data.forEach((label, i) => rpData[Number(label)] = Number(returnPeriods.data[i]))
  return Promise.resolve(rpData);
}

const membersToStats = membersArray => {
  // takes an array of equally sized subarrays (one for each member) and computes timestep-wise statistics
  const nMembers = membersArray.length
  const nTimesteps = membersArray[0].length
  let stats = {
    min: Array(nTimesteps).fill(0),
    p20: Array(nTimesteps).fill(0),
    p25: Array(nTimesteps).fill(0),
    median: Array(nTimesteps).fill(0),
    p75: Array(nTimesteps).fill(0),
    p80: Array(nTimesteps).fill(0),
    max: Array(nTimesteps).fill(0),
    average: Array(nTimesteps).fill(0),
  }
  Array(nTimesteps).fill(0).forEach((_, idx) => {
    const timestepValues = membersArray.map(member => member[idx]).sort((a, b) => a - b)
    stats.min[idx] = timestepValues[0]
    stats.p20[idx] = timestepValues[Math.floor(0.20 * nMembers)]
    stats.p25[idx] = timestepValues[Math.floor(0.25 * nMembers)]
    stats.median[idx] = timestepValues[Math.floor(0.5 * nMembers)]
    stats.p75[idx] = timestepValues[Math.floor(0.75 * nMembers)]
    stats.p80[idx] = timestepValues[Math.floor(0.80 * nMembers)]
    stats.max[idx] = timestepValues[nMembers - 1]
    stats.average[idx] = timestepValues.reduce((a, b) => a + b, 0) / nMembers
  })
  return stats
}

export {
  fetchForecast,
  fetchRetro,
  fetchReturnPeriods,
  membersToStats
}
