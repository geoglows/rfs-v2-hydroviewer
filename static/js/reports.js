import {bookmarks} from "./bookmarks.js";
import {plotForecast} from "./plots.js";

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
  const datasetList = reportTypes.find(r => r.type === reportType).datasets;
  const data = await fetchReportData({riverList, datasetList});
  plotReportData(data)
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
  const perRiverPromises = riverList.map(riverId => {
    return new Promise((resolve, reject) => perRiverResolvers.set(riverId, {resolve, reject}));
  });

  workers.forEach((w) => {
    w.onmessage = (e) => {
      const {status, riverId} = e.data;
      if (status === 'finished') {
        perRiverResolvers.get(riverId)?.resolve({
          riverId,
          forecast: e.data.forecast,
          returnPeriods: e.data.returnPeriods,
        });
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

  const results = await Promise.all(perRiverPromises);
  workers.forEach((w) => w.terminate());
  return results
}


const plotReportData = (data) => {
  // data should be an array of objects with keys riverId, forecast, returnPeriods, as fetched by the workers

  // now we're going to add a div to #report-results for each river, then plot the data in each.
  const reportResultsDiv = document.getElementById('report');
  reportResultsDiv.innerHTML = '';
  data.forEach(riverData => {
    const plotDivId = `report-river-forecast-plot-${riverData.riverId}`;
    const plotImgId = `report-river-forecast-img-${riverData.riverId}`;

    const pageDiv = document.createElement('div');
    pageDiv.className = 'report-page';
    reportResultsDiv.appendChild(pageDiv);

    const plotDiv = document.createElement('div');
    plotDiv.id = plotDivId;
    pageDiv.appendChild(plotDiv);

    const imgTag = document.createElement('img');
    imgTag.id = plotImgId;
    pageDiv.appendChild(imgTag);

    plotForecast({
      forecast: riverData.forecast,
      rp: riverData.returnPeriods,
      riverId: riverData.riverId,
      chartDiv: plotDiv,
    });
    // convert to an image url using Plotly.toImage,
    Plotly
      .toImage(plotDiv, {format: 'png', width: 1600, height: 900})
      .then(url => {
        imgTag.src = url;
        plotDiv.remove();
      })
  })
  // create a new iframe and copy the contents of the reportResultsDiv into it, then print the iframe
  const iframe = document.createElement('iframe');
  document.body.appendChild(iframe);
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(`<html><head><title>Report</title></head><body>${reportResultsDiv.innerHTML}</body></html>`);
  iframeDoc.close();
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  document.body.removeChild(iframe);
}
