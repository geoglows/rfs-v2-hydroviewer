import {divChartFdc, divChartForecast, divChartRetro, divChartStatus, divChartYearlyVol, divTableForecast, divYearlyPeaks, divHeatMap, lang} from './ui.js'

//////////////////////////////////////////////////////////////////////// Constants and configs
const defaultDateRange = ['2015-01-01', new Date().toISOString().split("T")[0]]
const percentiles = Array.from({length: 51}, (_, i) => i * 2)
const sortedArrayToPercentiles = array => percentiles.toReversed().map(p => array[Math.floor(array.length * p / 100) - (p === 100 ? 1 : 0)])
const secondsPerYear = 60 * 60 * 24 * 365.25
const statusPercentiles = [0, 13, 28, 72, 87]
const statusColors = [
  'rgb(44, 125, 205)',
  'rgb(142, 206, 238)',
  'rgb(231,226,188)',
  'rgb(255, 168, 133)',
  'rgb(205, 35, 63)'
]
const returnPeriodColors = {
  '2': 'rgb(254, 240, 1)',
  '5': 'rgb(253, 154, 1)',
  '10': 'rgb(255, 56, 5)',
  '25': 'rgb(255, 0, 0)',
  '50': 'rgb(128, 0, 106)',
  '100': 'rgb(128, 0, 246)',
}
const months = Array.from({length: 12}).map((_, idx) => (idx + 1).toString().padStart(2, '0'))
const monthNames = months.map(m => new Date(2021, parseInt(m, 10) - 1, 1).toLocaleString(lang, {month: 'short'}))

const experimentalPlotWatermark = [
  {
    text: text.plots.experimentalOverlay,
    xref: "paper",
    yref: "paper",
    x: 0.5,
    y: 0.5,
    showarrow: false,
    font: {
      size: 80,
      color: "rgba(0,0,0,0.25)"
    },
    xanchor: "center",
    yanchor: "middle"
  }
]

//////////////////////////////////////////////////////////////////////// Plots
const returnPeriodShapes = ({rp, x0, x1, maxFlow}) => {
  const visible = maxFlow > rp.return_periods['2'] ? true : 'legendonly'
  const box = (y0, y1, name) => {
    return {
      x: [x0, x1, x1, x0],
      y: [y0, y0, y1, y1],
      fillcolor: returnPeriodColors[name],
      fill: 'toself',
      line: {width: 0},
      mode: 'lines',
      opacity: 0.5,
      legendgroup: 'returnperiods',
      legendgrouptitle: {text: `${text.words.returnPeriods}`},
      showlegend: true,
      visible: visible,
      name: `${name}: ${rp.return_periods[name].toFixed(2)} m³/s`,
    }
  }
  return Object
    .keys(rp.return_periods)
    .map((key, index, array) => {
      const y0 = rp.return_periods[key]
      const y1 = index === array.length - 1 ? Math.max(rp.return_periods[key] * 1.15, maxFlow * 1.15) : rp.return_periods[array[index + 1]]
      return box(y0, y1, key)
    })
    .concat([{legendgroup: 'returnperiods', legendgrouptitle: {text: `${text.words.returnPeriods} m³/s`}}])
}
const plotForecast = ({forecast, rp, riverid, chartDiv}) => {
  chartDiv.innerHTML = ""
  const maxForecast = Math.max(...forecast.flow_median)
  const returnPeriods = returnPeriodShapes({rp, x0: forecast.datetime[0], x1: forecast.datetime[forecast.datetime.length - 1], maxFlow: maxForecast})
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: forecast.datetime.concat(forecast.datetime.slice().toReversed()),
        y: forecast.flow_uncertainty_lower.concat(forecast.flow_uncertainty_upper.slice().toReversed()),
        name: `${text.plots.fcLineUncertainty}`,
        fill: 'toself',
        fillcolor: 'rgba(44,182,255,0.6)',
        line: {color: 'rgba(0,0,0,0)'},
        legendgroup: 'forecast',
      },
      {
        x: forecast.datetime,
        y: forecast.flow_uncertainty_lower,
        line: {color: 'rgb(0,166,255)'},
        showlegend: false,
        name: '',
        legendgroup: 'forecast',
      },
      {
        x: forecast.datetime,
        y: forecast.flow_uncertainty_upper,
        line: {color: 'rgb(0,166,255)'},
        showlegend: false,
        name: '',
        legendgroup: 'forecast',
      },
      {
        x: forecast.datetime,
        y: forecast.flow_median,
        line: {color: 'black'},
        name: text.plots.fcLineMedian,
        legendgroup: 'forecast',
      },
      ...(forecast.flow_median_original ? [
        {
          x: forecast.datetime.concat(forecast.datetime.slice().toReversed()),
          y: forecast.flow_uncertainty_lower_original.concat(forecast.flow_uncertainty_upper_original.slice().toReversed()),
          name: text.plots.fcLineUncertaintyOriginal,
          fill: 'toself',
          fillcolor: 'rgba(227,212,9,0.8)',
          line: {color: 'rgba(0,0,0,0)'},
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
        {
          x: forecast.datetime,
          y: forecast.flow_uncertainty_lower_original,
          name: '',
          line: {color: 'rgb(255,236,0)'},
          showlegend: false,
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
        {
          x: forecast.datetime,
          y: forecast.flow_uncertainty_upper_original,
          name: '',
          line: {color: 'rgb(255,236,0)'},
          showlegend: false,
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
        {
          x: forecast.datetime,
          y: forecast.flow_median_original,
          name: text.plots.fcLineMedianOriginal,
          line: {color: 'blue'},
          visible: 'legendonly',
          legendgroup: 'forecastOriginal',
        },
      ] : []),
      ...returnPeriods,
    ],
    {
      title: {text: `${text.plots.fcTitle}${riverid}`},
      annotations: forecast.flow_median_original ? experimentalPlotWatermark : [],
      xaxis: {title: {text: `${text.plots.fcXaxis} (UTC +00:00)`}},
      yaxis: {
        title: {text: `${text.plots.fcYaxis} (m³/s)`},
        range: [0, null]
      },
    }
  )
}
const plotForecastMembers = ({forecast, rp, riverid, chartDiv}) => {
  chartDiv.innerHTML = ""
  const memberTraces = Object
    .keys(forecast)
    .filter(key => key.startsWith('ensemble_') && !key.endsWith('_original'))
    .map(key => {
      const memberNumber = parseInt(key.replace('ensemble_', ''))
      return {
        x: forecast.datetime,
        y: forecast[key],
        name: text.words.ensMembers,
        showlegend: memberNumber === 1,
        type: 'scatter',
        mode: 'lines',
        line: {width: 0.5, color: `rgb(0, 166, 255)`},
        legendgroup: 'forecastmembers',
      }
    })
  const maxForecast = Math.max(...memberTraces.map(trace => Math.max(...trace.y)))
  const returnPeriods = returnPeriodShapes({rp, x0: forecast.datetime[0], x1: forecast.datetime[forecast.datetime.length - 1], maxFlow: maxForecast})
  Plotly.newPlot(
    chartDiv,
    [...memberTraces, ...returnPeriods,],
    {
      title: {text: `${text.plots.fcMembersTitle}${riverid}`},
      annotations: forecast.ensemble_01_original ? experimentalPlotWatermark : [],
      xaxis: {title: {text: `${text.plots.fcXaxis} (UTC +00:00)`}},
      yaxis: {
        title: {text: `${text.plots.fcYaxis} (m³/s)`},
        range: [0, null]
      },
      legend: {'orientation': 'h'},
    }
  )
}
const forecastProbabilityTable = ({forecast, rp}) => {
  const memberKeys = Object.keys(forecast).filter(key => key.startsWith('ensemble_'))
  // groupby day so that each column is 1 day regardless of the sub time step for each of the ensemble_* arrays in memberKeys
  // makes an array containing 1 array per memberKey. each subarray has 1 value per day. shape is [memberKeys.length, numberOfDays]
  // stepsPerDay is known in advance, not determined by inspection
  const stepsPerDay = 8
  const arrayDailyBreakPoints = Array.from({length: Math.ceil(forecast.datetime.length / stepsPerDay)}, (_, i) => i * stepsPerDay)
  const dailyArrays = memberKeys.map(key => {
    return arrayDailyBreakPoints.map(startIdx => Math.max(...forecast[key].slice(startIdx, startIdx + stepsPerDay)))
  })
  const dailyDateStrings = forecast
    .datetime
    .filter((_, index) => index % stepsPerDay === 0)
    .map(date => new Date(date).toLocaleDateString(lang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }))
  const headerRow = `<tr><th>${text.words.returnPeriods}</th>${dailyDateStrings.map(date => `<th>${date}</th>`).join('')}</tr>`

  const returnPeriods = ['2', '5', '10', '25', '50', '100']
  const bodyRows = returnPeriods.map(rpKey => {
    const rpThreshold = rp.return_periods[rpKey]
    const percentages = dailyDateStrings.map((_, index) => {
      const countAboveThreshold = dailyArrays.reduce((count, dailyArray) => {
        return count + (dailyArray[index] > rpThreshold ? 1 : 0)
      }, 0)
      return (countAboveThreshold / memberKeys.length * 100).toFixed(0)
    })
    return `<tr><td>${rpKey} (${rpThreshold.toFixed(0)} m³/s)</td>${percentages.map(p => `<td style="background-color: ${returnPeriodColors[rpKey].replace('rgb', 'rgba').replace(')', `, ${p === "0" ? 0 : 0.25 + 0.75 * (p / 100)})`)}">${p}%</td>`).join('')}</tr>`
  })
  return `<table class="forecast-probability-table"><thead>${headerRow}</thead><tbody>${bodyRows.join('')}</tbody></table>`
}
const plotRetrospective = ({daily, monthly, riverid, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: daily.datetime,
        y: daily[riverid],
        type: 'lines',
        name: `${text.words.dailyAverage}`,
      },
      {
        x: Object.keys(monthly),
        y: Object.values(monthly),
        type: 'lines',
        name: `${text.words.monthlyAverage}`,
        line: {color: 'rgb(0, 166, 255)'},
        visible: 'legendonly'
      },
      // if there is a key ${river_id}_original, plot it also
      ...(biasCorrected ? [{
        x: daily.datetime,
        y: daily[`${riverid}_original`],
        type: 'lines',
        name: `${text.words.dailyAverageOriginal}`,
        line: {color: 'rgb(255, 0, 0)'},
        visible: 'legendonly'
      }] : [])
    ],
    {
      title: {text: `${text.plots.retroTitle} ${riverid}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      legend: {orientation: 'h', x: 0, y: 1},
      hovermode: 'x',
      yaxis: {
        title: {text: `${text.plots.retroYaxis} (m³/s)`},
        range: [0, null]
      },
      xaxis: {
        title: {text: `${text.plots.retroXaxis} (UTC +00:00)`},
        type: 'date',
        autorange: false,
        range: defaultDateRange,
        rangeslider: {},
        rangeselector: {
          buttons: [
            {
              count: 1,
              label: `1 ${text.words.year}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              count: 5,
              label: `5 ${text.words.years}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              count: 10,
              label: `10 ${text.words.years}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              count: 30,
              label: `30 ${text.words.years}`,
              step: 'year',
              stepmode: 'backward'
            },
            {
              label: `${text.words.all}`,
              count: daily.datetime.length,
              step: 'day',
            }
          ]
        },
      }
    }
  )
}
const plotYearlyVolumes = ({yearly, averages, riverid, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: yearly.map(x => x.year),
        y: yearly.map(y => y.value),
        type: 'line',
        name: `${text.words.annualVolume}`,
        marker: {color: 'rgb(0, 166, 255)'}
      },
      ...averages?.map((x, idx) => {
        return {
          x: [x.period, (idx + 1 < averages.length ? averages[idx + 1].period : x.period + 5)],
          y: [x.average, x.average],
          type: 'scatter',
          mode: 'lines',
          legendgroup: `${text.words.fiveYearAverage}`,
          showlegend: idx === 0,
          name: `${text.words.fiveYearAverage}`,
          marker: {color: 'red'},
        }
      }) || []
    ],
    {
      title: {text: `${text.plots.volumeTitle}${riverid}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      legend: {orientation: 'h'},
      hovermode: 'x',
      xaxis: {title: {text: `${text.words.year}`}},
      yaxis: {
        title: {text: `${text.words.millionMetersCubed} (m³ * 10^6)`},
        range: [0, null]
      }
    }
  )
}
const plotStatuses = ({statuses, monthlyAverages, monthlyAverageTimeseries, riverid, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  const years = Array.from(new Set(Object.keys(monthlyAverageTimeseries).map(k => k.split('-')[0]))).sort((a, b) => a - b)

  Plotly.newPlot(
    chartDiv,
    [
      // shaded regions for thresholds based on percentiles
      ...statusColors.map((color, idx) => {
        const label = text.statusLabels[idx]
        const nextLabel = text.statusLabels[idx + 1]
        const lastEntry = idx === text.statusLabels.length - 1
        return {
          x: months.concat(...months.toReversed()),
          y: statuses[label].concat(lastEntry ? Array.from({length: 12}).fill(0) : statuses[nextLabel].toReversed()),
          mode: 'lines',
          fill: 'toself',
          name: label,
          line: {width: 0},
          fillcolor: color,
          visible: 'legendonly',
          legendgrouptitle: {text: `${text.words.monthlyStatusCategories}`},
        }
      }),
      // long term or total monthly average
      {
        x: monthlyAverages.map(x => x.month),
        y: monthlyAverages.map(y => y.value),
        mode: 'lines',
        name: `${text.words.monthlyAverageFlows}`,
        visible: true,
        line: {color: 'rgb(0,157,255)', width: 3, dash: 'dash'},
      },
      // each individual year's monthly averages
      ...years.toReversed().map((year, idx) => {
        const values = Object
          .keys(monthlyAverageTimeseries)
          .filter(k => k.startsWith(`${year}-`))
          .map(k => monthlyAverageTimeseries[k])
          .flat()
        return {
          x: months,
          y: values,
          name: `${text.words.year} ${year}`,
          visible: idx === 0 ? true : 'legendonly',
          mode: 'lines',
          line: {width: 2, color: 'black'}
        }
      })
    ],
    {
      title: {text: `${text.plots.statusTitle}${riverid}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      xaxis: {
        title: {text: `${text.words.month}`},
        tickvals: months,
        ticktext: monthNames,
      },
      hovermode: 'x',
      yaxis: {
        title: {text: `${text.words.flow} (m³/s)`},
        range: [0, null]
      },
    }
  )
}
const plotFdc = ({fdc, monthlyFdc, riverid, chartDiv, biasCorrected}) => {
  chartDiv.innerHTML = ""
  Plotly.newPlot(
    chartDiv,
    [
      {
        x: percentiles,
        y: fdc,
        type: 'lines',
        name: `${text.words.flowDurationCurve}`,
      },
      ...Object
        .keys(monthlyFdc)
        .sort()
        .map((m, idx) => {
          return {
            x: percentiles,
            y: monthlyFdc[m],
            type: 'line',
            name: `${text.words.fdc} ${monthNames[idx]}`,
            visible: 'legendonly',
          }
        })
    ],
    {
      title: {text: `${text.plots.fdcTitle}${riverid}`},
      annotations: biasCorrected ? experimentalPlotWatermark : [],
      xaxis: {title: {text: `${text.words.percentile} (%)`}},
      yaxis: {
        title: {text: `${text.words.flow} (m³/s)`},
        range: [0, null]
      },
      legend: {orientation: 'h'},
      hovermode: 'x',
    }
  )
}

const plotYearlyPeaks = ({ yearlyPeaks, riverid, chartDiv }) => {
  if (!chartDiv) return; //
    chartDiv.innerHTML = "";

  const currentYear = new Date().getFullYear();

  // Filter valid range
  yearlyPeaks = yearlyPeaks
    .filter(p => p.year < currentYear).sort((a, b) => a.year - b.year);

  // --- Convert DOY → Month/Day ---
  const doyToDate = doy => {
    const date = new Date(2024, 0); // leap year safety
    date.setDate(doy);
    const month = date.toLocaleString(lang, { month: "short" });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  // --- Circular logic for outlier detection ---
  const angles = yearlyPeaks.map(d => (2 * Math.PI * (d.doy - 1)) / 365.0);
  const circularDistance = (a1, a2) =>
    Math.min(Math.abs(a1 - a2), 2 * Math.PI - Math.abs(a1 - a2));

  const meanSin = angles.reduce((s, a) => s + Math.sin(a), 0) / angles.length;
  const meanCos = angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length;
  const meanAngle = Math.atan2(meanSin, meanCos);

  const distancesRad = angles.map(a => circularDistance(a, meanAngle));
  const distancesDays = distancesRad.map(d => d * (365 / (2 * Math.PI)));

  // Boxplot method for outliers
  const sortedDistancesDays = [...distancesDays].sort((a, b) => a - b);
  const percentile = (arr, q) => {
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    return arr[base + 1] !== undefined
      ? arr[base] + rest * (arr[base + 1] - arr[base])
      : arr[base];
  };
  const q1 = percentile(sortedDistancesDays, 0.25);
  const q3 = percentile(sortedDistancesDays, 0.75);
  const iqr = q3 - q1;
  const threshold = q3 + 1.5 * iqr;

  const outlierIndices = distancesDays
    .map((d, i) => (d > threshold ? i : -1))
    .filter(i => i !== -1);

  const outliers = outlierIndices.map(i => yearlyPeaks[i]);
  const normalPoints = yearlyPeaks.filter(
    (_, i) => !outlierIndices.includes(i)
  );

  // --- Circular median DOY ---
  const circularMedian = angles => {
    const n = angles.length;
    let minTotalDist = Infinity;
    let medianAngle = 0;

    for (let i = 0; i < n; i++) {
      const a = angles[i];
      const totalDist = angles.reduce((sum, x) => {
        let d = Math.abs(x - a);
        d = Math.min(d, 2 * Math.PI - d);
        return sum + d;
      }, 0);

      if (totalDist < minTotalDist) {
        minTotalDist = totalDist;
        medianAngle = a;
      }
    }
    return medianAngle;
  };

  const medianAngle = circularMedian(angles);
  const medianDoy = Math.round((medianAngle / (2 * Math.PI)) * 365) + 1;

  // --- Color bins ---
  const peaks = yearlyPeaks.map(p => p.peak);
  const minVal = Math.min(...peaks);
  const maxVal = Math.max(...peaks);
  const nBins = 5;
  const viridisBins = ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"];

  const getBinColor = val => {
    const bin = Math.floor(((val - minVal) / (maxVal - minVal)) * nBins);
    return viridisBins[Math.min(bin, nBins - 1)];
  };

  const formatVal = val => {
    if (val >= 1000) {
      const rounded = Math.round((val / 1000) * 10) / 10;
      return `${rounded}k`;
    } else if (val === 0) {
      return "0";
    } else {
      const magnitude = Math.floor(Math.log10(Math.abs(val)));
      const factor = 10 ** (magnitude - 2);
      return Math.round(val / factor) * factor;
    }
  };

  const binRanges = [];
  for (let i = 0; i < nBins; i++) {
    const lower = formatVal(minVal + (i * (maxVal - minVal)) / nBins);
    const upper = formatVal(minVal + ((i + 1) * (maxVal - minVal)) / nBins);
    binRanges.push(`${lower}-${upper}`);
  }

  Plotly.newPlot(
    chartDiv,
    [
      {
        name: `${text.words.annualPeak}`,
        x: normalPoints.map(p => p.doy),
        y: normalPoints.map(p => p.year),
        mode: "markers",
        type: "scatter",
        marker: {
          size: 9,
          color: normalPoints.map(p => getBinColor(p.peak)),
          line: { width: 0 },
        },
        text: normalPoints.map(
          p =>
            `${text.words.year}: ${p.year}<br>${doyToDate(p.doy)} (DOY ${p.doy})<br>${text.words.discharge}: ${formatVal(p.peak)} m³/s`
        ),
        hovertemplate: "%{text}<extra></extra>",
        showlegend: false,
      },
      {
        name: `${text.words.temporalOutliers}`,
        x: outliers.map(p => p.doy),
        y: outliers.map(p => p.year),
        mode: "markers",
        type: "scatter",
        marker: {
          size: 15,
          color: "rgba(0,0,0,0)",
          line: { color: "red", width: 2 },
        },
        hoverinfo: "skip",
      },
      {
        x: outliers.map(p => p.doy),
        y: outliers.map(p => p.year),
        mode: "markers",
        type: "scatter",
        marker: {
          size: 9,
          color: outliers.map(p => getBinColor(p.peak)),
          line: { width: 0 },
        },
        text: outliers.map(
          p =>
            `${text.words.year}: ${p.year}<br>${doyToDate(p.doy)} (DOY ${p.doy})<br>${text.words.discharge}: ${formatVal(p.peak)} m³/s`
        ),
        hovertemplate: "%{text}<extra></extra>",
        showlegend: false,
      },
      {
        x: [medianDoy, medianDoy],
        y: [
          Math.min(...yearlyPeaks.map(p => p.year)) - 1,
          Math.max(...yearlyPeaks.map(p => p.year)) + 1,
        ],
        mode: "lines",
        line: { dash: "dash", width: 1, color: "black" },
        hoverinfo: "none",
        name: `${text.words.medianDOY}`,
        showlegend: true,
      },
      ...viridisBins.map((color, i) => ({
        x: [null],
        y: [null],
        mode: "markers",
        type: "scatter",
        marker: { size: 9, color: color },
        name: `${binRanges[i]}`,
        showlegend: true,
      })),
    ],
     {
      title: {
        text: `${text.plots.peaksTitle}${riverid}`,
        x: 0.5,
        xanchor: "center",
        yanchor: "top",
      },
      xaxis: {
        title: {
          text: `${text.plots.peaksXaxis}`,
        },
        range: [0, 366],
        dtick: 30,
        tickfont: { size: 12 },
      },
      yaxis: {
        title: {
          text: `${text.words.year}`,
        },
        tickfont: { size: 12 },
      },
      height: 560,
      margin: { t: 80, l: 80, r: 180, b: 70 },
      legend: {
        x: 1.05,
        y: 1,
        bgcolor: "rgba(255,255,255,0)",
        bordercolor: "rgba(0,0,0,0)",
        title: { text: `${text.words.peakDischarge} (m³/s)` },
      },
    }
  );
};

// fix the hover template for the 2nd of every month
const plotHeatMap = ({ retro, riverid, chartDiv }) => {
  if (!chartDiv) return;
  chartDiv.innerHTML = "";

  // --- Build array of (year, doy, flow) ---
  const daily = retro.datetime.map((currentValue, currentIndex) => {
    const date = new Date(currentValue);
    const year = date.getUTCFullYear();

    // DOY in UTC (includes Feb 29 for leap years)
    const doy = Math.floor(
      (Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - Date.UTC(year, 0, 0)) / 86400000
    )

    const flow = retro[riverid][currentIndex];
    return { year, doy, flow };
  });

  // --- Group by year ---
  const grouped = daily.reduce((acc, d) => {
    if (!acc[d.year]) acc[d.year] = [];
    acc[d.year].push(d);
    return acc;
  }, {});

  // --- Find all years in the dataset ---
  const validYears = Object.keys(grouped)
    .map(y => parseInt(y))
    .sort((a, b) => a - b);

  // --- Determine max DOY for axis labels (handles leap years) ---
  const maxDoy = Math.max(...daily.map(d => d.doy));
  const days = Array.from({ length: maxDoy }, (_, i) => i + 1);

  // --- Convert DOY to Month/Day for hovertemplate ---
  const doyToDate = (year, doy) => {
    const date = new Date(Date.UTC(year, 0, doy));
    const month = date.toLocaleString(lang, { month: "short", timeZone: "UTC" });
    const day = date.getUTCDate();
    return `${month} ${day}`;
  };

  const textMatrix = validYears.map(y =>
    days.map(doy => doyToDate(y, doy))
  );

  // --- Build lookup for flow values ---
  const flowLookup = {};
  daily.forEach(d => {
    flowLookup[`${d.year}-${d.doy}`] = d.flow;
  });

  // --- Build 2D data matrix ---
  const dataMatrix = validYears.map(y =>
    days.map(d => flowLookup[`${y}-${d}`] ?? null)
  );

  // --- Compute data range ---
  const dataFlat = dataMatrix.flat().filter(v => v != null);
  const dataMin = Math.min(...dataFlat);
  const dataMax = Math.max(...dataFlat);

  // --- BINNING SECTION ---
  const nBins = 7;
  const colors = ["#440154", "#414487", "#2a788e", "#22a884", "#7ad151", "#bddf26", "#fde725"];

  const formatVal = val => {
    if (val >= 1000) {
      const rounded = Math.round((val / 1000) * 10) / 10;
      return `${rounded}k`;
    } else if (val === 0) {
      return "0";
    } else {
      const magnitude = Math.floor(Math.log10(Math.abs(val)));
      const factor = 10 ** (magnitude - 2);
      return Math.round(val / factor) * factor;
    }
  };

  const binEdges = Array.from({ length: nBins + 1 }, (_, i) =>
    dataMin + (i * (dataMax - dataMin)) / nBins
  );

  const colorscale = [];
  for (let i = 0; i < nBins; i++) {
    const p1 = i / nBins;
    const p2 = (i + 1) / nBins;
    colorscale.push([p1, colors[i]], [p2, colors[i]]);
  }

  const binnedMatrix = dataMatrix.map(row =>
    row.map(v => {
      if (v == null) return null;
      for (let i = 0; i < nBins; i++) {
        if (v <= binEdges[i + 1]) return (binEdges[i] + binEdges[i + 1]) / 2;
      }
      return (binEdges[nBins - 1] + binEdges[nBins]) / 2;
    })
  );

  // --- Month overlay ---
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthStarts = monthNames.map((_, i) => {
    const date = new Date(Date.UTC(2023, i, 1)); // non-leap reference for start of month
    return Math.floor((date - Date.UTC(2023, 0, 0)) / 86400000) + 1;
  });

  // --- Layout ---
  const layout = {
    title: { text: `${text.plots.heatMapTitle}${riverid}`, x: 0.5 },
    xaxis: { title: { text: `${text.plots.heatMapXaxis}` }, tickmode: "array", tickvals: monthStarts, ticktext: monthNames, side: "bottom" },
    yaxis: { title: { text: `${text.words.year}` }, range: [1985, null] },
    margin: { t: 80, l: 80, r: 80, b: 70 },
    height: 560,
  };

  // --- Plot ---
  Plotly.newPlot(chartDiv, [
    {
      z: binnedMatrix,
      x: days,
      y: validYears,
      type: "heatmap",
      colorscale: colorscale,
      zmin: dataMin,
      zmax: dataMax,
      text: textMatrix,
      hovertemplate: `${text.words.year}: %{y}<br>${text.words.doy}: %{text} (%{x})<br>${text.words.discharge}: %{z} m³/s<extra></extra>`,
      colorbar: {
        title: { text: `${text.words.discharge} (m³/s)`, side: "top" },
        tickvals: binEdges.slice(0, -1).map((v, i) => (v + binEdges[i + 1]) / 2),
        ticktext: binEdges.slice(0, -1).map((v, i) => `${formatVal(v)}–${formatVal(binEdges[i + 1])}`)
      }
    }
  ], layout);
};

//////////////////////////////////////////////////////////////////////// Helper Functions
const clearCharts = chartTypes => {
  if (chartTypes === "forecast" || chartTypes === null || chartTypes === undefined) {
    [divChartForecast, divTableForecast]
      .forEach(el => el.innerHTML = '')
  }
  if (chartTypes === "retro" || chartTypes === null || chartTypes === undefined) {
    [divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc, divYearlyPeaks, divHeatMap]
      .forEach(el => {if (el) el.innerHTML = ''})
  }
}

//////////////////////////////////////////////////////////////////////// Plotting Managers
const plotAllRetro = ({retro, riverid}) => {
  let monthlyAverages = []
  let yearlyVolumes = []
  let monthlyAverageTimeseries = {}
  let monthlyFdc = {}
  let monthlyStatusValues = {}
  let yearlyPeaks = {}
  text.statusLabels.forEach(label => monthlyStatusValues[label] = [])
  const biasCorrected = retro.hasOwnProperty(`${riverid}_original`)

  // Get subsets of data with the same YYYY-MM timestamp
  let monthlyValues = retro.datetime.reduce((acc, currentValue, currentIndex) => {
    const date = new Date(currentValue)
    const datestring = date.toISOString().slice(0, 7)
    if (!acc[datestring]) acc[datestring] = []
    acc[datestring].push(retro[riverid][currentIndex])
    return acc
  }, {})
  const fdc = sortedArrayToPercentiles(retro[riverid].toSorted((a, b) => a - b))
  const years = Array.from(new Set(Object.keys(monthlyValues).map(k => k.split('-')[0]))).sort((a, b) => a - b)

  // Calculate yearly discharge peaks.
  retro.datetime.forEach((currentValue, currentIndex) => {
  const date = new Date(currentValue)
      const localTime = new Date(date.getTime() + date.getTimezoneOffset() * 60000)

  const year = localTime.getFullYear()
  const doy = Math.round(
  (localTime - new Date(localTime.getFullYear(), 0, 0)) / 86400000)// day of year
  const value = retro[riverid][currentIndex]

  // store max per year with its day of year
  if (!yearlyPeaks[year] || value > yearlyPeaks[year].peak) {
    yearlyPeaks[year] = { year, doy, peak: value }
  }
})

// convert to array
yearlyPeaks = Object.values(yearlyPeaks).sort((a, b) => a.year - b.year)

  // Calculate monthly averages from the monthly values. Minimum 20 values to calculate a monthly average.
  Object
    .keys(monthlyValues)
    .forEach(k => {
      if (monthlyValues[k].length < 20) {
        delete monthlyValues[k]
        return
      }
      monthlyAverageTimeseries[k] = monthlyValues[k].reduce((a, b) => a + b, 0) / monthlyValues[k].length
    })
  months
    .forEach(month => {
      const values = Object.keys(monthlyValues).filter(k => k.endsWith(`-${month}`)).map(k => monthlyValues[k]).flat().sort((a, b) => b - a)
      statusPercentiles.forEach((percentile, idx) => {
        monthlyStatusValues[Object.keys(monthlyStatusValues)[idx]].push(values[Math.floor(values.length * percentile / 100)])
      })
      monthlyAverages.push({month, value: values.reduce((a, b) => a + b, 0) / values.length})
      monthlyFdc[month] = sortedArrayToPercentiles(values.toReversed())
    })
  years
    .forEach(year => {
      const yearValues = Object.keys(monthlyAverageTimeseries).filter(k => k.startsWith(`${year}-`)).map(k => monthlyAverageTimeseries[k])
      if (yearValues.length === 12) yearlyVolumes.push({year, value: yearValues.reduce((a, b) => a + b, 0) / 12 * secondsPerYear / 1e6})
    })
  const fiveYearlyAverages = yearlyVolumes
    .reduce((acc, {year, value}) => {
      const period = Math.floor(year / 5) * 5
      let group = acc.find(g => g.period === period)
      if (!group) {
        group = {period, total: 0, count: 0}
        acc.push(group)
      }
      group.total += value
      group.count += 1
      return acc
    }, [])
    .map(({period, total, count}) => ({
      period,
      average: total / count
    }))

  plotRetrospective({daily: retro, monthly: monthlyAverageTimeseries, riverid, chartDiv: divChartRetro, biasCorrected})
  plotYearlyVolumes({yearly: yearlyVolumes, averages: fiveYearlyAverages, riverid, chartDiv: divChartYearlyVol, biasCorrected})
  plotStatuses({statuses: monthlyStatusValues, monthlyAverages, monthlyAverageTimeseries, riverid, chartDiv: divChartStatus, biasCorrected})
  plotFdc({fdc, monthlyFdc, riverid, chartDiv: divChartFdc, biasCorrected})
  plotYearlyPeaks({yearlyPeaks, riverid, chartDiv: divYearlyPeaks})
  plotHeatMap({retro, riverid, chartDiv: divHeatMap})
}
const plotAllForecast = ({forecast, rp, riverid, showMembers}) => {
  showMembers ? plotForecastMembers({forecast, rp, riverid, chartDiv: divChartForecast}) : plotForecast({forecast, rp, riverid, chartDiv: divChartForecast})
  divTableForecast.innerHTML = showMembers ? forecastProbabilityTable({forecast, rp}) : ''
}

//////////////////////////////////////////////////////////////////////// Event Listeners
window.addEventListener('resize', () => [divChartForecast, divChartRetro, divChartYearlyVol, divChartStatus, divChartFdc].forEach(chart => Plotly.Plots.resize(chart)))

export {plotAllRetro, plotAllForecast, clearCharts}
