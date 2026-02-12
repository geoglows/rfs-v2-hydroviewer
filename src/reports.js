import {bookmarks} from "./bookmarks.js";
import {forecastProbabilityTable, plotForecast} from "./plots.js";
import {loadingImageTag} from "./ui.js";
import DataFetcherWorker from './workers/dataFetcher.js?worker';
import Plotly from "plotly.js/lib/core";
import {translationDictionary} from "./intl.js";
import {Lang} from "./states/state.js";

const logoURL = 'https://training.geoglows.org/static/images/NewGEOGLOWSLOGO.png'

const maxWorkers = 3;
const workers = Array.from({length: maxWorkers}, () => new DataFetcherWorker());

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
    alert(translationDictionary.ui.reportError);
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
  const todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // we have a div.report in the main document so we can render plotly graphs, get their image url, then in an iframe build the report
  let reportPages = data.map(async (riverData, index) => {
    const riverName = bookmarks.list().find(r => r.id === riverData.riverId).name
    const pageTitle = `${riverName} (ID: ${riverData.riverId})`;

    // render a plotly graph and get its image url
    plotForecast({
      forecast: riverData.forecast,
      rp: riverData.returnPeriods,
      riverId: riverData.riverId,
      chartDiv: reportRenderSpace,
    });
    // remove all the controls from the plotDiv and make it src
    reportRenderSpace.querySelectorAll('.modebar, .legendtoggle, .zoomlayer').forEach(el => el.remove());
    const url = await Plotly.toImage(reportRenderSpace, {format: 'png', width: 800, height: 500})
    reportRenderSpace.innerHTML = '';

    nFormatted += 1;
    let progress = ((nFormatted / nRivers) * 100).toFixed(0);
    reportFormatProgress.value = progress
    reportFormatLabel.innerText = `${progress}%`;

    return `
    <div class="report-page page-break">
        <div class="report-page-title">${pageTitle}</div>
        <div class="figure-container">
            <img class="report-figure" src="${url}" alt="Forecast Plot for River ID ${riverData.riverId}">
            <div class="figure-caption">Figure ${index + 1}: Forecast for River ${riverData.riverId}</div>
        </div>
        <div class="report-table">
            ${forecastProbabilityTable({forecast: riverData.forecast, rp: riverData.returnPeriods})}
        </div>
        <div class="comments-section">
            <h3>Comments for Figure ${index + 1}</h3>
            <p>Notes:</p>
            <div class="comment-lines"></div>
            <div class="comment-lines"></div>
            <div class="comment-lines"></div>
        </div>
    </div>
`;
  })

  reportPages = await Promise.all(reportPages);

  const coverPageHTML = `
  <div class="report-page page-break cover-page">
      <div class="logo-container">
          <img src="${logoURL}" style="width: 3in;" alt="GEOGloWS Logo">
      </div>
      <div class="cover-title">Hydrology Report</div>
      <div class="cover-subtitle">Daily Forecast Report<br>Generated: ${todayDate}</div>
      
      <div class="references-section">
          <h2>Data Sources & References</h2>
          <table class="reference-table">
              <tr><td>Primary Forecast Engine</td><td>RFS-Hydroviewer API (hydroviewer.geoglows.org)</td></tr>
              <tr><td>Historical Data</td><td>AWS Public Dataset (s3://geoglows-v2-retrospective)</td></tr>
              <tr><td>Training & Documentation</td><td>training.geoglows.org</td></tr>
              <tr><td>More Information</td><td>www.geoglows.org</td></tr>
          </table>
          <p class="disclaimer">This report was generated automatically. Verify all results with local observation data.</p>
      </div>
  </div>
  `;
  const printDocument = reportIframe.contentDocument || reportIframe.contentWindow.document;
  printDocument.open();
  printDocument.write(`
<html lang="${Lang.get()}">
<head>
  <title>River Forecast Report</title>
  <style>
    @page { size: letter; margin: 0; }
    
    body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 0; }
    
    /* LAYOUT UTILS */
    .report-page { padding: 0.5in; max-width: 8.5in; margin: 0 auto; }
    .page-break { page-break-after: always; min-height: 9.5in; position: relative; }
    
    /* COVER PAGE STYLES */
    .cover-page { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding-top: 1in; }
    .cover-title { font-size: 36pt; font-weight: bold; color: #003366; margin-top: 1em; margin-bottom: 0.2em; }
    .cover-subtitle { font-size: 14pt; font-style: italic; color: #666; margin-bottom: 3in; }
    .references-section { width: 100%; text-align: left; margin-top: auto; }
    .references-section h2 { border-bottom: 2px solid #ddd; padding-bottom: 5px; color: #003366; }
    .reference-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
    .reference-table td { padding: 6px; border-bottom: 1px solid #eee; }
    .disclaimer { font-size: 8pt; color: #999; margin-top: 1em; text-align: center; }

    /* REPORT CONTENT STYLES */
    .report-page-title { font-size: 18pt; font-weight: bold; color: #003366; border-bottom: 2px solid #003366; margin-bottom: 1em; }
    .figure-container { text-align: center; margin-bottom: 1em; }
    .report-figure { width: 100%; max-height: 500px; object-fit: contain; }
    .figure-caption { font-size: 10pt; font-style: italic; color: #555; margin-top: 5px; }
    
    /* TABLE STYLES (Existing + New) */
    .report-table { margin-bottom: 2em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: center; font-size: 9pt; }
    th { background-color: #f0f0f0; }

    /* COMMENTS SECTION */
    .comments-section { margin-top: 2em; page-break-inside: avoid; }
    .comments-section h3 { font-size: 12pt; color: #003366; margin-bottom: 5px; }
    .comment-lines { border-bottom: 1px solid #333; height: 30px; margin-bottom: 10px; }

    /* PRINT OPTIMIZATION */
    @media print {
        body { -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div id="report">
    ${coverPageHTML}
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
