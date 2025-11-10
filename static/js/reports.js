import {bookmarks} from "./bookmarks.js";
import {forecastProbabilityTable, plotForecast} from "./plots.js";

const loadingImageTag = '<img src="/static/img/loading.io.svg" alt="loading" style="height: 100%">'

const maxWorkers = 3;
const workers = Array.from({length: maxWorkers}, () => new Worker('/static/js/workers/dataFetcher.js', {type: 'module'}));

const reportIframe = document.getElementById('report-pdf-frame');
const reportRenderSpace = document.getElementById('report-render-space');
const newReportButton = document.getElementById('new-report-button');
const reportTypeSelect = document.getElementById('report-type-select');
const reportDatePicker = document.getElementById('report-date-calendar');
const reportRiverListSelect = document.getElementById('report-river-list-select');
const reportPrintButton = document.getElementById('download-report');
const reportDownloadProgress = document.getElementById('report-data-progress');
const reportDownloadLabel = document.getElementById('report-data-label');
const reportFormatProgress = document.getElementById('report-format-progress');
const reportFormatLabel = document.getElementById('report-format-label');

const reportTypes = [
  {type: 'riverForecasts', label: 'Daily Forecast Report', datasets: ['forecast', 'returnPeriods']},
]

// todo get a list of available report types and populate the select
// todo get a list of the riverLists available and populate the select

const generateReportButton = document.getElementById('generate-report')
const resetProgressIndicators = () => {
  reportDownloadProgress.value = 0
  reportFormatProgress.value = 0
  reportDownloadLabel.textContent = '0%';
  reportFormatLabel.textContent = '0%';
}
const toggleReportControls = ({disabled = true}) => {
  generateReportButton.disabled = disabled;
  reportTypeSelect.disabled = disabled;
  reportDatePicker.disabled = disabled;
  reportRiverListSelect.disabled = disabled;
}
const togglePrintButton = ({disabled = true}) => {
  reportPrintButton.disabled = disabled;
  newReportButton.disabled = disabled;
}
newReportButton.addEventListener('click', () => {
  togglePrintButton({disabled: true});
  toggleReportControls({disabled: false});
  resetProgressIndicators()
})
generateReportButton.addEventListener('click', async () => {
  toggleReportControls({disabled: true});
  generateReportButton.innerHTML += loadingImageTag
  resetProgressIndicators();

  try {
    const reportType = reportTypeSelect.value;
    const riverList = bookmarks.list().map(b => b.id);
    const datasetList = reportTypes.find(r => r.type === reportType).datasets;
    const data = await fetchReportData({riverList, datasetList});
    await plotReportData(data)
  } catch (error) {
    console.error('Error generating report:', error);
    alert('An error occurred while generating the report. Please try again.');
  } finally {
    generateReportButton.innerText = generateReportButton.innerText.split(loadingImageTag).join('');
  }
})
reportPrintButton.addEventListener('click', () => printIframe());

const fetchReportData = async ({riverList, datasetList}) => {
  const nRivers = riverList.length;
  let nFinished = 0;

  const forecastDate = reportDatePicker.value.replace(/-/g, '');

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

const plotReportData = async (data) => {
  let nFormatted = 0;
  const nRivers = data.length;

  // we have a div.report in the main document so we can render plotly graphs, get their image url, then in an iframe build the report
  let reportPages = data.map(async riverData => {
    const pageTitle = `${bookmarks.list().find(r => r.id === riverData.riverId).name} (ID: ${riverData.riverId})`;

    // render a plotly graph and get its image url
    plotForecast({
      forecast: riverData.forecast,
      rp: riverData.returnPeriods,
      riverId: riverData.riverId,
      chartDiv: reportRenderSpace,
    });
    // remove all the controls from the plotDiv and make it static
    reportRenderSpace.querySelectorAll('.modebar, .legendtoggle, .zoomlayer').forEach(el => el.remove());
    const url = await Plotly.toImage(reportRenderSpace, {format: 'png', width: 800, height: 500})
    reportRenderSpace.innerHTML = '';

    nFormatted += 1;
    let progress = ((nFormatted / nRivers) * 100).toFixed(0);
    reportFormatProgress.value = progress
    reportFormatLabel.innerText = `${progress}%`;

    return `
<div class="report-page">
<div class="report-page-title">${pageTitle}</div>
<img class="report-figure" src="${url}" alt="Forecast Plot for River ID ${riverData.riverId}">
<div class="report-table">
${forecastProbabilityTable({forecast: riverData.forecast, rp: riverData.returnPeriods})}
</div>
</div>
`;
  })

  reportPages = await Promise.all(reportPages);
  const printDocument = reportIframe.contentDocument || reportIframe.contentWindow.document;
  printDocument.open();
  printDocument.write(`
<html lang="en">
<head>
  <title>River Forecast Report</title>
  <link rel="stylesheet" type="text/css" href="/static/css/report.print.css">
</head>
<body>
  <div id="report">
    ${reportPages.join('')}
  </div>
</body>
</html>
`);
  printDocument.close();
  // wait for the iframe to render everything
  reportIframe.onload = () => {
    togglePrintButton({disabled: false});
    printIframe()
  }
}

const printIframe = () => {
  reportIframe.focus();
  reportIframe.contentWindow.print();
}
