import {bookmarks} from "./bookmarks.js";
import {forecastProbabilityTable, plotForecast} from "./plots.js";
import DataFetcherWorker from './workers/dataFetcher.js?worker';
import Plotly from "plotly.js/lib/core";
import {translationDictionary} from "./intl.js";
import {Lang} from "./states/state.js";
import {reportCSS, buildCoverPage, buildReportPage, buildReportDocument} from "./reportTemplate.js";

const logoURL = '/img/geoglowslogo.png';

const maxWorkers = 3;

const reportIframe = document.getElementById('report-pdf-frame');
const reportRenderSpace = document.getElementById('report-render-space');
const reportPreviewContainer = document.getElementById('report-preview-container');
const closePreviewButton = document.getElementById('close-preview');
const downloadPreviewButton = document.getElementById('download-report-preview');
const previewReportButton = document.getElementById('preview-report');
const newReportButton = document.getElementById('new-report-button');
const reportTypeSelect = document.getElementById('report-type-select');
const reportDatePicker = document.getElementById('report-date-calendar');
const reportRiverListSelect = document.getElementById('report-river-list-select');
const reportPrintButton = document.getElementById('download-report');
const reportDownloadProgress = document.getElementById('report-data-progress');
const reportDownloadLabel = document.getElementById('report-data-label');
const reportFormatProgress = document.getElementById('report-format-progress');
const reportFormatLabel = document.getElementById('report-format-label');
const generateReportButton = document.getElementById('generate-report');
const cancelReportButton = document.getElementById('cancel-report');

const reportTypes = [
  {type: 'riverForecasts', label: 'Daily Forecast Report', datasets: ['forecast', 'returnPeriods']},
]

// Worker pool and cancellation state
let workers = [];
let cancelled = false;

const createWorkers = () => {
  workers = Array.from({length: maxWorkers}, () => new DataFetcherWorker());
};
const terminateWorkers = () => {
  workers.forEach(w => w.terminate());
  workers = [];
};

const resetProgressIndicators = () => {
  reportDownloadProgress.value = 0;
  reportFormatProgress.value = 0;
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
  previewReportButton.disabled = disabled;
  newReportButton.disabled = disabled;
}
const showPreview = () => reportPreviewContainer.classList.add('active');
const hidePreview = () => reportPreviewContainer.classList.remove('active');
const toggleCancelButton = ({disabled = true}) => {
  cancelReportButton.disabled = disabled;
}

cancelReportButton.addEventListener('click', () => {
  cancelled = true;
  terminateWorkers();
  toggleReportControls({disabled: false});
  toggleCancelButton({disabled: true});
  resetProgressIndicators();
});

newReportButton.addEventListener('click', () => {
  togglePrintButton({disabled: true});
  toggleReportControls({disabled: false});
  resetProgressIndicators()
})
generateReportButton.addEventListener('click', async () => {
  if (!reportDatePicker.value) {
    alert(translationDictionary.ui.reportDateRequired);
    return;
  }

  cancelled = false;
  toggleReportControls({disabled: true});
  toggleCancelButton({disabled: false});
  resetProgressIndicators();

  try {
    const reportType = reportTypeSelect.value;
    const riverList = bookmarks.list().map(b => b.id);
    const datasetList = reportTypes.find(r => r.type === reportType).datasets;
    const data = await fetchReportData({riverList, datasetList});
    if (cancelled) return;
    await plotReportData(data)
  } catch (error) {
    if (cancelled) return;
    console.error('Error generating report:', error);
    alert(translationDictionary.ui.reportError);
  } finally {
    toggleCancelButton({disabled: true});
    terminateWorkers();
  }
})
reportPrintButton.addEventListener('click', () => printIframe());
closePreviewButton.addEventListener('click', () => hidePreview());
downloadPreviewButton.addEventListener('click', () => printIframe());
previewReportButton.addEventListener('click', () => showPreview());

const fetchReportData = async ({riverList, datasetList}) => {
  createWorkers();
  const nRivers = riverList.length;
  let nFinished = 0;

  const forecastDate = reportDatePicker.value.replace(/-/g, '');

  const perRiverResolvers = new Map();
  const perRiverPromises = riverList.map(riverId => {
    return new Promise((resolve, reject) => perRiverResolvers.set(riverId, {resolve, reject}));
  });

  workers.forEach((w) => {
    w.onmessage = (e) => {
      const {status, riverId} = e.data;
      if (status === 'started') return;
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
      reportDownloadProgress.value = progress;
      reportDownloadLabel.textContent = `${progress}%`;
    };
  });

  riverList.forEach((riverId, i) => workers[i % maxWorkers].postMessage({riverId, forecastDate, datasetList}))
  return await Promise.all(perRiverPromises)
}

const plotReportData = async (data) => {
  let nFormatted = 0;
  const nRivers = data.length;
  const todayDate = new Date().toLocaleDateString(Lang.get(), {year: 'numeric', month: 'long', day: 'numeric'});
  const translations = translationDictionary.report;

  // Render each river page sequentially to avoid shared-div race conditions
  const reportPages = [];
  for (const [index, riverData] of data.entries()) {
    if (cancelled) return;

    const bookmark = bookmarks.list().find(r => r.id === riverData.riverId);
    const riverName = bookmark ? bookmark.name : `River ${riverData.riverId}`;
    const pageTitle = `${riverName} (ID: ${riverData.riverId})`;

    let pageHTML = '';
    try {
      plotForecast({
        forecast: riverData.forecast,
        rp: riverData.returnPeriods,
        riverId: riverData.riverId,
        chartDiv: reportRenderSpace,
      });
      reportRenderSpace.querySelectorAll('.modebar, .legendtoggle, .zoomlayer').forEach(el => el.remove());
      const url = await Plotly.toImage(reportRenderSpace, {format: 'png', width: 800, height: 500});
      reportRenderSpace.innerHTML = '';

      const tableHTML = forecastProbabilityTable({forecast: riverData.forecast, rp: riverData.returnPeriods});
      pageHTML = buildReportPage({pageTitle, imageUrl: url, riverId: riverData.riverId, index, tableHTML, translations});
    } catch (error) {
      console.error(`Error rendering report page for river ${riverData.riverId}:`, error);
      reportRenderSpace.innerHTML = '';
    }

    if (pageHTML) reportPages.push(pageHTML);

    nFormatted += 1;
    const progress = ((nFormatted / nRivers) * 100).toFixed(0);
    reportFormatProgress.value = progress;
    reportFormatLabel.textContent = `${progress}%`;
  }

  if (cancelled) return;

  const coverPageHTML = buildCoverPage({logoURL, todayDate, translations});
  const documentHTML = buildReportDocument({
    lang: Lang.get(),
    css: reportCSS,
    coverPageHTML,
    reportPagesHTML: reportPages.join(''),
    translations,
  });

  const printDocument = reportIframe.contentDocument || reportIframe.contentWindow.document;
  printDocument.open();
  printDocument.write(documentHTML);
  printDocument.close();
  togglePrintButton({disabled: false});
  showPreview();
}

const printIframe = () => {
  reportIframe.focus();
  reportIframe.contentWindow.print();
}
