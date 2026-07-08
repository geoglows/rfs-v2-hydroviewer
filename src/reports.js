import {bookmarks} from "./bookmarks.js";
import {forecastProbabilityTable, plotForecast, plotExceedanceProbabilities, plotFlowAnomaly} from "./plots.js";
import DataFetcherWorker from './workers/dataFetcher.js?worker';
import Plotly from "plotly.js/lib/core";
import {translationDictionary} from "./intl.js";
import {Lang} from "./states/state.js";
import {reportCSS, buildCoverPage, buildReportPage, buildReportDocument, buildBulletinPage} from "./reportTemplate.js";
import {buildBulletinData} from "./data/bulletinAnalytics.js";

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
  {type: 'riverForecasts',    label: 'Daily Forecast Report',        datasets: ['forecast', 'returnPeriods']},
  {type: 'highFlows',         label: 'High Flow Alerts Only',         datasets: ['forecast', 'returnPeriods']},
  {type: 'streamflowBulletin',label: 'Streamflow Flood Bulletin',     datasets: ['forecast', 'returnPeriods', 'retrospective']},
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
    await plotReportData(data, reportType)
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

// ─── Data fetching ───────────────────────────────────────────────────────────
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
          retrospective: e.data.retrospective ?? null,  // null for non-bulletin report types
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

// ─── Plot rendering ──────────────────────────────────────────────────────────

const renderChartToPng = async (plotFn, args) => {
  reportRenderSpace.style.width = '800px';
  reportRenderSpace.style.height = '800px';
  await plotFn({...args, chartDiv: reportRenderSpace});
  reportRenderSpace.querySelectorAll('.modebar, .legendtoggle, .zoomlayer').forEach(el => el.remove());
  const url = await Plotly.toImage(reportRenderSpace, {format: 'png', width: 800, height: 400});
  reportRenderSpace.innerHTML = '';
  return url;
}

const plotReportData = async (data, reportType) => {
  let nFormatted = 0;
  const nRivers = data.length;
  const todayDate = new Date().toLocaleDateString(Lang.get(), {year: 'numeric', month: 'long', day: 'numeric'});
  const translations = translationDictionary.report;

  const reportPages = [];

  for (const [index, riverData] of data.entries()) {
    if (cancelled) return;

    // ── Filter: highFlows only includes rivers exceeding 2-yr RP ────────────
    if (reportType === 'highFlows') {
      const rp2 = riverData.returnPeriods?.['2'];
      const maxForecast = Math.max(...riverData.forecast.stats.max);
      if (!rp2 || maxForecast < rp2) {
        nFormatted += 1;
        updateFormatProgress(nFormatted, nRivers);
        continue;
      }
    }

    // ── Filter: bulletin only includes rivers with any flood alert ───────────
    if (reportType === 'streamflowBulletin') {
      const rp2 = riverData.returnPeriods?.[2];
      const maxForecast = Math.max(...riverData.forecast.stats.max);
      if (!rp2 || maxForecast < rp2) {
        nFormatted += 1;
        updateFormatProgress(nFormatted, nRivers);
        continue;
      }
    }

    const bookmark = bookmarks.list().find(r => r.id === riverData.riverId);
    const riverName = bookmark ? bookmark.name : `River ${riverData.riverId}`;

    let pageHTML = '';
    try {
      if (reportType === 'streamflowBulletin') {
        pageHTML = await renderBulletinPage({riverData, riverName, index, translations, todayDate});
      } else {
        pageHTML = await renderStandardPage({riverData, riverName, index, translations});
      }
    } catch (error) {
      console.error(`Error rendering report page for river ${riverData.riverId}:`, error);
      reportRenderSpace.innerHTML = '';
    }

    if (pageHTML) reportPages.push(pageHTML);

    nFormatted += 1;
    updateFormatProgress(nFormatted, nRivers);
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

// ─── Standard forecast page (existing reports) ───────────────────────────────

const renderStandardPage = async ({riverData, riverName, index, translations}) => {
  const pageTitle = `${riverName} (ID: ${riverData.riverId})`;
  const forecastImageUrl = await renderChartToPng(plotForecast, {
    forecast: riverData.forecast,
    rp: riverData.returnPeriods,
    riverId: riverData.riverId,
  });
  const tableHTML = forecastProbabilityTable({forecast: riverData.forecast, rp: riverData.returnPeriods});
  return buildReportPage({pageTitle, imageUrl: forecastImageUrl, riverId: riverData.riverId, index, tableHTML, translations});
}

// ─── Bulletin page (new) ──────────────────────────────────────────────────────

const renderBulletinPage = async ({riverData, riverName, index, translations, todayDate}) => {
  // Run all analytics computations
  const bulletin = buildBulletinData({riverData});
  console.log('flowAnomaly:', bulletin.flowAnomaly);
  console.log('retrospective:', riverData.retrospective);
  // Render chart 1: statistical forecast (existing plot function)
  const forecastImageUrl = await renderChartToPng(plotForecast, {
    forecast: riverData.forecast,
    rp: riverData.returnPeriods,
    riverId: riverData.riverId,
  });

  // Render chart 2: exceedance probabilities (new plot function needed in plots.js)
  const exceedanceImageUrl = await renderChartToPng(plotExceedanceProbabilities, {
    exceedance: bulletin.exceedance,
    overallAlert: bulletin.overallAlert,
  });

  // Render chart 3: flow anomaly vs climatology (new plot function needed in plots.js)
  // Only render if retrospective data was available
  let anomalyImageUrl = null;
  if (bulletin.flowAnomaly) {
    anomalyImageUrl = await renderChartToPng(plotFlowAnomaly, {
      flowAnomaly: bulletin.flowAnomaly,
      riverName,
    });
  }

  return buildBulletinPage({
    riverName,
    riverId: riverData.riverId,
    index,
    todayDate,
    translations,
    bulletin,
    returnPeriods: riverData.returnPeriods,
    forecastImageUrl,
    exceedanceImageUrl,
    anomalyImageUrl,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const updateFormatProgress = (nFormatted, nRivers) => {
  const progress = ((nFormatted / nRivers) * 100).toFixed(0);
  reportFormatProgress.value = progress;
  reportFormatLabel.textContent = `${progress}%`;
}

const printIframe = () => {
  reportIframe.focus();
  reportIframe.contentWindow.print();
}
