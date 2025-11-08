import {bookmarks} from "./bookmarks.js";
import {forecastProbabilityTable, plotForecast} from "./plots.js";

const maxWorkers = 3;
const workers = Array.from({length: maxWorkers}, () => new Worker('/static/js/workers/dataFetcher.js', {type: 'module'}));

const reportTypeSelect = document.getElementById('report-type-select');
const reportRiverListSelect = document.getElementById('report-river-list-select');
const reportDownloadProgress = document.getElementById('report-data-progress');
const reportDownloadLabel = document.getElementById('report-data-label');
const reportFormatProgress = document.getElementById('report-format-progress');
const reportFormatLabel = document.getElementById('report-format-label');

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

const generateReportButton = document.getElementById('generate-report')
const resetProgressIndicators = () => {
  reportDownloadProgress.value = 0
  reportFormatProgress.value = 0
  reportDownloadLabel.textContent = '0%';
  reportFormatLabel.textContent = '0%';
}
generateReportButton.addEventListener('click', async () => {
  // disable the button until this is completed or error handled
  generateReportButton.disabled = true;
  generateReportButton.innerText = 'Generating Report...';
  resetProgressIndicators();

  try {
    const reportType = reportTypeSelect.value;
    const riverListName = reportRiverListSelect.value;
    // todo get the river IDs for the selected river list
    const riverList = bookmarks.list().map(b => b.id);
    const datasetList = reportTypes.find(r => r.type === reportType).datasets;
    const data = await fetchReportData({riverList, datasetList});
    plotReportData(data)
  } catch (error) {
    // todo error handle and message UI
    console.error('Error generating report:', error);
    alert('An error occurred while generating the report. Please try again.');
  } finally {
    generateReportButton.disabled = false;
    generateReportButton.innerText = 'Generate Report';
  }
})

const fetchReportData = async ({riverList, datasetList}) => {
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
      if (status === 'started') return
      if (status === 'finished') {
        perRiverResolvers.get(riverId)?.resolve({
          riverId,
          forecast: e.data.forecast,
          returnPeriods: e.data.returnPeriods,
        });
        nFinished += 1;
      }
      if (status === 'error') {
        console.error(`Error fetching data for river ${riverId}:`, e.data.errors);
        perRiverResolvers.get(riverId)?.reject(new Error(`Worker error: ${riverId}`));
      }
      const progress = ((nFinished / nRivers) * 100).toFixed(0);
      reportDownloadProgress.value = progress
      reportDownloadLabel.innerText = `${progress}%`;
    };
  });

  riverList.forEach((riverId, i) => workers[i % maxWorkers].postMessage({riverId, forecastDate, datasetList}))
  return await Promise.all(perRiverPromises)
}


const plotReportData = (data) => {
  // data should be an array of objects with keys riverId, forecast, returnPeriods, as fetched by the workers

  // now we're going to add a div to #report-results for each river, then plot the data in each.
  const reportResultsDiv = document.getElementById('report');
  reportResultsDiv.innerHTML = '';

  const nRivers = data.length;
  let nComplete = 0;

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

    const tableDiv = document.createElement('div');
    tableDiv.id = `report-river-forecast-table-${riverData.riverId}`;
    tableDiv.style.width = '100%';
    tableDiv.style.maxWidth = '100%';
    pageDiv.appendChild(tableDiv);

    plotForecast({
      forecast: riverData.forecast,
      rp: riverData.returnPeriods,
      riverId: riverData.riverId,
      chartDiv: plotDiv,
    });
    // remove all the controls from the plotDiv and make it static
    plotDiv.querySelectorAll('.modebar, .legendtoggle, .zoomlayer').forEach(el => el.remove());
    // convert to an image url using Plotly.toImage,
    Plotly
      .toImage(plotDiv, {format: 'png', width: 800, height: 600})
      .then(url => {
        imgTag.src = url;
        plotDiv.remove();
      })
    tableDiv.innerHTML = forecastProbabilityTable({forecast: riverData.forecast, rp: riverData.returnPeriods})

    nComplete += 1;
    let progress = ((nComplete / nRivers) * 100).toFixed(0);
    reportFormatProgress.value = progress
    reportFormatLabel.innerText = `${progress}%`;
  })
  // print the #report div after short delay for all rendering to complete
  setTimeout(() => {
    window.print()
  }, 1000);
}
