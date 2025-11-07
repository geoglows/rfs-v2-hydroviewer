import {bookmarks} from "./bookmarks.js";

const reportTypeSelect = document.getElementById('report-type-select');
const reportRiverListSelect = document.getElementById('report-river-list-select');
const reportDownloadProgress = document.getElementById('report-data-progress');

const reportTypes = [
  {type: 'riverSummary', label: 'River Summary', datasets: ['forecast', 'retro', 'returnPeriods']},
  {type: 'riverListForecasts', label: 'River List Forecasts', datasets: ['forecast', 'returnPeriods']},
]

reportTypeSelect.innerHTML = reportTypes.map(report => `<option value="${report.type}">${report.label}</option>`).join('');
reportTypeSelect.addEventListener('change', event => showReportRiverLists(event.target));
const riverLists = ['Defaults', 'Custom1', 'Custom2'];
reportRiverListSelect.innerHTML = riverLists.map((listName, idx) => `<option value="${listName}" ${idx === 0 ? 'selected' : ''}>${listName}</option>`).join('')

// todo on select report type, the options for the report should include the forecast date range available for that report type

const showReportRiverLists = (element) => {
  const reportType = element.value;
  //todo get a list of the riverLists available and populate the select
}

document.getElementById('start-report-data-download').addEventListener('click', async () => {
  const reportType = reportTypeSelect.value;
  const riverListName = reportRiverListSelect.value;
  // todo get the river IDs for the selected river list
  const riverList = bookmarks.list().map(b => b.id);
  // todo check to see how many of these rivers have data already cached for the report type
  const datasetList = reportTypes.find(r => r.type === reportType).datasets;
  await fetchReportData({riverList, datasetList});
  alert('Report data download complete!');
})

const fetchReportData = async ({riverList, datasetList}) => {
  const maxWorkers = 3;
  // spawn workers, maximum of 3. number to use should be nRivers / 5 rounded up max 3
  const numWorkers = Math.min(maxWorkers, Math.ceil(riverList.length / 5));
  const workers = Array.from({length: numWorkers}, () => new Worker('/static/js/workers/dataFetcher.js', {type: 'module'}));

  const nRivers = riverList.length;
  let nFinished = 0;

  const forecastDate = "20251015" // todo

  const perRiverResolvers = new Map(); // riverId -> resolve
  const perRiverPromises = riverList.map((riverId) =>
    new Promise((resolve, reject) => perRiverResolvers.set(riverId, {resolve, reject}))
  );

  workers.forEach((w) => {
    w.onmessage = (e) => {
      const {status, riverId} = e.data;
      if (status === 'finished') {
        perRiverResolvers.get(riverId)?.resolve();
        nFinished += 1;
        reportDownloadProgress.value = (nFinished / nRivers) * 100;
      }
      if (status === 'error') {
        console.error(`Error fetching data for river ${riverId}:`, e.data.errors);
        perRiverResolvers.get(riverId)?.reject(new Error(`Worker error: ${riverId}`));
        nFinished += 1;
        reportDownloadProgress.value = (nFinished / nRivers) * 100;
      }
    };
  });

  riverList.forEach((riverId, i) => workers[i % numWorkers].postMessage({riverId, forecastDate, datasetList}))

  await Promise.all(perRiverPromises);
  workers.forEach(w => w.terminate());
}
