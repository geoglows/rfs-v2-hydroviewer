export const reportCSS = `
    @page { size: letter; margin: 0.5in; }

    body { font-family: 'Arial', sans-serif; color: #333; margin: 0; padding: 0; }

    /* LAYOUT UTILS */
    .report-page { max-width: 8.5in; margin: 0 auto; box-sizing: border-box; }
    .page-break { page-break-after: always; }

    /* SCREEN PREVIEW — simulate printed pages */
    @media screen {
        body { background-color: #525659; padding: 20px 0; }
        .report-page {
            width: 8.5in;
            min-height: 11in;
            padding: 0.5in;
            margin: 20px auto;
            background: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
    }

    /* COVER PAGE STYLES */
    /* justify-content: space-between pushes the footer to the bottom */
    .cover-page {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        text-align: center;
        min-height: 10in;
        padding-top: 0.5in;
        padding-bottom: 0.3in;
    }
    .cover-main { display: flex; flex-direction: column; align-items: center; }
    .cover-title { font-size: 36pt; font-weight: bold; color: #003366; margin-top: 0.5em; margin-bottom: 0.2em; }
    .cover-subtitle { font-size: 14pt; font-style: italic; color: #666; margin-bottom: 0; }
    .references-section { width: 100%; text-align: center; }
    .references-section p { font-size: 10pt; margin: 6px 0; }
    .references-section a { color: #003366; }

    /* REPORT CONTENT STYLES */
    .report-page-title { font-size: 18pt; font-weight: bold; color: #003366; border-bottom: 2px solid #003366; margin-bottom: 1em; }
    .figure-container { text-align: center; margin-bottom: 0.5em; }
    .report-figure { width: 100%; max-height: 500px; object-fit: contain; }
    .figure-caption { font-size: 10pt; font-style: italic; color: #555; margin-top: 5px; }
    p { margin: 0; }

    /* TABLE STYLES */
    .report-table { margin-bottom: 0.5em; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 5px; text-align: center; font-size: 9pt; }
    th { background-color: #f0f0f0; }

    /* COMMENTS SECTION */
    .comments-section { margin-top: 0.5em; page-break-inside: avoid; }
    .comments-section h3 { font-size: 12pt; color: #003366; margin-bottom: 5px; }
    .comment-field { width: 100%; border: 1px solid #999; padding: 6px; font-family: 'Arial', sans-serif; font-size: 10pt; resize: vertical; box-sizing: border-box; }
    .comment-field:focus { outline: none; border-color: #003366; }
    @media print { .comment-field { border: 1px solid #ccc; resize: none; } }

    /* ── BULLETIN STYLES ─────────────────────────────────────────────────── */
    .bulletin-page {
        font-family: Arial, sans-serif;
        font-size: 10pt;
    }

    /* Info header — dark blue bar with river name / ID / date */
    .bulletin-info-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
    }
    .bulletin-info-table td {
        background: #F0F4F8;
        border: 1px solid #D0D8E0;
        padding: 5px 10px;
        font-size: 10pt;
        text-align: left;
    }

    /* Overall alert banner */
    .bulletin-alert-overall {
        color: white;
        font-size: 13pt;
        font-weight: bold;
        text-align: center;
        padding: 8px;
        margin-bottom: 3px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* Two sub-alert boxes side by side */
    .bulletin-alert-row {
        display: table;
        width: 100%;
        border-collapse: separate;
        border-spacing: 3px 0;
        margin-bottom: 8px;
    }
    .bulletin-alert-sub {
        display: table-cell;
        width: 50%;
        color: white;
        font-size: 8.5pt;
        padding: 6px 8px;
        vertical-align: middle;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* Key stats table */
    .bulletin-stats-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 8px;
        font-size: 9pt;
    }
    .bulletin-stats-table th {
        background: #E8EEF4;
        border: 1px solid #C0C8D0;
        padding: 5px 4px;
        text-align: center;
        font-weight: bold;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .bulletin-stats-table td {
        border: 1px solid #C0C8D0;
        padding: 5px 4px;
        text-align: center;
        font-weight: bold;
    }

    /* Section heading (blue with underline) */
    .bulletin-section { margin-bottom: 8px; }
    .bulletin-section-title {
        color: #0B3D6B;
        font-size: 11pt;
        font-weight: bold;
        margin: 0 0 4px 0;
        border-bottom: 2px solid #0B3D6B;
        padding-bottom: 2px;
    }

    /* Charts */
    .bulletin-chart {
        width: 100%;
        display: block;
        max-height: 280px;
        object-fit: contain;
    }

    /* Return period table — centered, half width */
    .bulletin-rp-table {
        width: 50%;
        border-collapse: collapse;
        font-size: 9pt;
        margin: 0 auto;
    }
    .bulletin-rp-table th {
        background: #1A3A5C;
        color: white;
        padding: 5px 12px;
        text-align: center;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .bulletin-rp-table td {
        border: 1px solid #C0C8D0;
        padding: 4px 12px;
        text-align: center;
    }
    .bulletin-rp-table tr:nth-child(even) td {
        background: #F0F4F8;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* Footer */
    .bulletin-footer {
        margin-top: 12px;
        padding-top: 6px;
        border-top: 1px solid #ccc;
        font-size: 7.5pt;
        color: #888;
        text-align: center;
    }

    /* PRINT OPTIMIZATION */
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
`;

export const buildCoverPage = ({logoURL, todayDate, translations}) => `
  <div class="report-page page-break cover-page">
      <div class="cover-main">
          <div class="logo-container">
              <img src="${logoURL}" style="width: 3in;" alt="GEOGloWS Logo">
          </div>
          <div class="cover-title">${translations.coverTitle}</div>
          <div class="cover-subtitle">${translations.coverSubtitle}<br>${translations.generated}: ${todayDate}</div>
      </div>

      <div class="references-section">
          <p>${translations.sourceReport} <a href="https://apps.geoglows.org/hydroviewer" target="_blank">apps.geoglows.org/hydroviewer</a></p>
          <p>${translations.sourceData} <a href="https://aws.amazon.com/marketplace/pp/prodview-gne36pxf5jbqk" target="_blank">s3://geoglows-v2</a></p>
          <p>${translations.sourceLearnMore} <a href="https://training.geoglows.org" target="_blank">training.geoglows.org</a></p>
          <p>${translations.disclaimer}</p>
      </div>
  </div>
`;

export const buildReportPage = ({pageTitle, imageUrl, riverId, index, tableHTML, translations}) => `
    <div class="report-page page-break">
        <div class="report-page-title">${pageTitle}</div>
        <div class="figure-container">
            <img class="report-figure" src="${imageUrl}" alt="${translations.forecastForRiver} ${riverId}">
            <div class="figure-caption">${translations.figureCaption} ${index + 1}: ${translations.forecastForRiver} ${riverId}</div>
        </div>
        <div class="report-table">
            ${tableHTML}
        </div>
        <div class="comments-section">
            <p>${translations.notes}</p>
            <textarea class="comment-field" rows="4" placeholder="${translations.commentPlaceholder}"></textarea>
        </div>
    </div>
`;

export const buildBulletinPage = ({
  riverName, riverId, index, todayDate, translations,
  bulletin, returnPeriods,
  forecastImageUrl, exceedanceImageUrl, anomalyImageUrl,
}) => {
  const {overallAlert, ensembleAlert, medianAlert, peakFlow, meanFlow} = bulletin;

  const alertBgColor = {
    GREEN:  '#228B22',
    YELLOW: '#DAA520',
    ORANGE: '#FF8C00',
    RED:    '#CC0000',
  };

  const overallBg  = alertBgColor[overallAlert.level]  ?? '#228B22';
  const ensembleBg = alertBgColor[ensembleAlert.level] ?? '#228B22';
  const medianBg   = alertBgColor[medianAlert.level]   ?? '#228B22';

  const rpRows = Object.entries(returnPeriods)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([rp, val]) => `
      <tr>
        <td>${rp}-Year</td>
        <td>${Number(val).toFixed(2)}</td>
      </tr>`)
    .join('');

  const anomalySection = anomalyImageUrl ? `
    <div class="bulletin-section">
      <h3 class="bulletin-section-title">Forecast Flow Anomaly vs. Climatology</h3>
      <img src="${anomalyImageUrl}" class="bulletin-chart" alt="Flow Anomaly Chart" />
    </div>` : '';

  return `
    <div class="report-page bulletin-page" data-river-id="${riverId}">

      <!-- River info header -->
      <table class="bulletin-info-table">
        <tr>
          <td><strong>River Station:</strong> ${riverName}</td>
          <td><strong>GEOGLOWS ID:</strong> ${riverId}</td>
        </tr>
        <tr>
          <td><strong>Issued:</strong> ${todayDate}</td>
          <td></td>
        </tr>
      </table>

      <!-- Overall alert banner -->
      <div class="bulletin-alert-overall" style="background:${overallBg}">
        OVERALL ALERT: ${overallAlert.level}
      </div>

      <!-- Sub alerts — side by side using display:table so they print reliably -->
      <div class="bulletin-alert-row">
        <div class="bulletin-alert-sub" style="background:${ensembleBg}">
          <strong>Ensemble (&gt;30%): ${ensembleAlert.level}</strong><br/>
          ${ensembleAlert.description}
        </div>
        <div class="bulletin-alert-sub" style="background:${medianBg}">
          <strong>Median Flow: ${medianAlert.level}</strong><br/>
          ${medianAlert.description}
        </div>
      </div>

      <!-- Key stats table -->
      <table class="bulletin-stats-table">
        <thead>
          <tr>
            <th>Peak Forecast</th>
            <th>Mean Forecast</th>
            <th>2-yr Threshold</th>
            <th>10-yr Threshold</th>
            <th>25-yr Threshold</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${peakFlow.toFixed(2)} m³/s</td>
            <td>${meanFlow.toFixed(2)} m³/s</td>
            <td>${Number(returnPeriods[2]).toFixed(1)} m³/s</td>
            <td>${Number(returnPeriods[10]).toFixed(1)} m³/s</td>
            <td>${Number(returnPeriods[25]).toFixed(1)} m³/s</td>
          </tr>
        </tbody>
      </table>

      <!-- Chart 1: Statistical Forecast -->
      <div class="bulletin-section">
        <h3 class="bulletin-section-title">Statistical Forecast (15-Day Ensemble)</h3>
        <img src="${forecastImageUrl}" class="bulletin-chart" alt="Forecast Chart" />
      </div>

      <!-- Chart 2: Exceedance Probabilities — on same page as forecast -->
      <div class="bulletin-section">
        <h3 class="bulletin-section-title">Flood Exceedance Probabilities</h3>
        <img src="${exceedanceImageUrl}" class="bulletin-chart" alt="Exceedance Probability Chart" />
      </div>

      <!-- Page 2 -->
      <div class="page-break"></div>

      <!-- Chart 3: Flow Anomaly -->
      ${anomalySection}

      <!-- Return Period Table -->
      <div class="bulletin-section">
        <h3 class="bulletin-section-title">Return Period Thresholds</h3>
        <table class="bulletin-rp-table">
          <thead>
            <tr><th>Return Period</th><th>Threshold (m³/s)</th></tr>
          </thead>
          <tbody>${rpRows}</tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="bulletin-footer">
        Produced using GEOGLOWS ECMWF Streamflow Service v2 |
        Model: ECMWF ENS (51-member ensemble + 1 high-res deterministic) <br>
        Retrospective Baseline: 1940–2024 (84 years)
      </div>

    </div>`;
};

export const buildReportDocument = ({lang, css, coverPageHTML, reportPagesHTML, translations}) => `
<html lang="${lang}">
<head>
  <title>${translations.pageTitle}</title>
  <style>${css}</style>
</head>
<body>
  <div id="report">
    ${coverPageHTML}
    ${reportPagesHTML}
  </div>
</body>
</html>
`;