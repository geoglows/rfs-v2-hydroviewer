const LEVEL_RANK = {GREEN: 0, YELLOW: 1, ORANGE: 2, RED: 3};
const LEVEL_COLOR = {
  GREEN:  '#228B22',
  YELLOW: '#DAA520',
  ORANGE: '#FF8C00',
  RED:    '#CC0000',
};

const RP_ALERT = {
  100: 'RED',
  50:  'RED',
  25:  'RED',
  10:  'ORANGE',
  5:   'ORANGE',
  2:   'YELLOW',
};

/**
 * computeExceedanceProbabilities
 *
 * For each timestep, compute what % of the 51 ensemble members exceed
 * each return period threshold.
 *
 * @param {number[][]} discharge  - forecast.discharge: array of 51 arrays, one per member
 * @param {Date[]}     datetime   - forecast.datetime: one Date per timestep
 * @param {Object}     returnPeriods - { 2: Number, 5: Number, 10: Number, ... }
 * @returns {Object} {
 *   datetime: Date[],
 *   byRP: {
 *     2:   number[],   // % of members exceeding 2-yr threshold at each timestep
 *     5:   number[],
 *     10:  number[],
 *     25:  number[],
 *     50:  number[],
 *     100: number[],
 *   }
 * }
 */
export const computeExceedanceProbabilities = ({discharge, datetime, returnPeriods}) => {
  const nMembers = discharge.length;
  const nTimesteps = datetime.length;
  const rpLabels = Object.keys(returnPeriods).map(Number).sort((a, b) => a - b);

  const byRP = {};
  for (const rp of rpLabels) {
    const threshold = returnPeriods[rp];
    byRP[rp] = Array(nTimesteps).fill(0).map((_, t) => {
      const exceedCount = discharge.filter(member => member[t] > threshold).length;
      return parseFloat(((exceedCount / nMembers) * 100).toFixed(1));
    });
  }

  return {datetime, byRP};
};

/**
 * classifyAlertEnsemble
 *
 * Checks each return period from highest to lowest. If >30% of ensembles
 * exceed that threshold on ANY single timestep, that level is returned.
 *
 * @param {Object} exceedance - output of computeExceedanceProbabilities
 * @param {number} probThreshold - default 30
 * @returns {{ level: string, color: string, description: string, peakDate: Date|null, peakRP: number|null }}
 */
export const classifyAlertEnsemble = ({exceedance, probThreshold = 30}) => {
  const {datetime, byRP} = exceedance;
  const rpLabels = Object.keys(byRP).map(Number).sort((a, b) => b - a); // descending

  for (const rp of rpLabels) {
    const probs = byRP[rp];
    const peakProb = Math.max(...probs);
    if (peakProb >= probThreshold) {
      const peakIdx = probs.indexOf(peakProb);
      const peakDate = datetime[peakIdx];
      const level = RP_ALERT[rp] || 'YELLOW';
      const dateStr = peakDate instanceof Date
        ? peakDate.toISOString().slice(0, 10)
        : String(peakDate).slice(0, 10);
      return {
        level,
        color: LEVEL_COLOR[level],
        description: `${level} — ${peakProb.toFixed(0)}% of ensembles exceed ${rp}-yr threshold on ${dateStr}`,
        peakDate,
        peakRP: rp,
      };
    }
  }

  return {
    level: 'GREEN',
    color: LEVEL_COLOR.GREEN,
    description: 'NORMAL — No threshold breached by >30% of ensembles',
    peakDate: null,
    peakRP: null,
  };
};

/**
 * classifyAlertMedian
 *
 * Checks peak median flow against return period thresholds.
 *
 * @param {number[]} medianFlow   - forecast.stats.median
 * @param {Date[]}   datetime     - forecast.datetime
 * @param {Object}   returnPeriods
 * @returns {{ level, color, description, peakFlow, peakDate }}
 */
export const classifyAlertMedian = ({medianFlow, datetime, returnPeriods}) => {
  const peakFlow = Math.max(...medianFlow);
  const peakIdx = medianFlow.indexOf(peakFlow);
  const peakDate = datetime[peakIdx];
  const dateStr = peakDate instanceof Date
    ? peakDate.toISOString().slice(0, 10)
    : String(peakDate).slice(0, 10);

  const rpLabels = Object.keys(returnPeriods).map(Number).sort((a, b) => b - a); // descending

  for (const rp of rpLabels) {
    if (peakFlow >= returnPeriods[rp]) {
      const level = RP_ALERT[rp] || 'YELLOW';
      return {
        level,
        color: LEVEL_COLOR[level],
        description: `${level} — Median flow (${peakFlow.toFixed(1)} m³/s) exceeds ${rp}-yr threshold (${returnPeriods[rp].toFixed(1)} m³/s) on ${dateStr}`,
        peakFlow,
        peakDate,
      };
    }
  }

  return {
    level: 'GREEN',
    color: LEVEL_COLOR.GREEN,
    description: `NORMAL — Peak median (${peakFlow.toFixed(1)} m³/s) below all thresholds`,
    peakFlow,
    peakDate,
  };
};

/**
 * classifyOverallAlert
 *
 * Returns whichever of the two alerts is worse.
 */
export const classifyOverallAlert = ({ensembleAlert, medianAlert}) => {
  const ensRank = LEVEL_RANK[ensembleAlert.level] ?? 0;
  const medRank = LEVEL_RANK[medianAlert.level] ?? 0;
  const winner = medRank > ensRank ? medianAlert : ensembleAlert;
  return {level: winner.level, color: winner.color};
};

/**
 * computeDailyAverages
 *
 * Groups retrospective discharge by day-of-year (MM-DD) and computes the
 * mean across all years. Returns a Map keyed on "MM-DD" strings.
 *
 * @param {Date[]}   datetime  - retro.datetime
 * @param {number[]} discharge - retro.discharge
 * @returns {Map<string, number>}  e.g. "02-25" → 42.3
 */
export const computeDailyAverages = ({datetime, discharge}) => {
  const buckets = new Map(); // "MM-DD" → [values]

  datetime.forEach((dt, i) => {
    const d = dt instanceof Date ? dt : new Date(dt);
    const key = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(discharge[i]);
  });

  const averages = new Map();
  for (const [key, vals] of buckets) {
    averages.set(key, vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  return averages;
};

/**
 * computeFlowAnomaly
 *
 * For each forecast timestep, subtract the climatological daily average
 * for that calendar day from the forecast average flow.
 *
 * @param {Date[]}          datetime      - forecast.datetime
 * @param {number[]}        averageFlow   - forecast.stats.average
 * @param {Map<string,number>} dailyAvgs  - output of computeDailyAverages
 * @returns {{ datetime: Date[], anomaly: number[] }}
 */
export const computeFlowAnomaly = ({datetime, averageFlow, dailyAvgs}) => {
  const dayBuckets = new Map(); // "YYY-MM-DD" -> { flows: number[], key: "MM-DD", date: Date }

  datetime.forEach((dt, i) => {
      const d = dt instanceof Date ? dt : new Date(dt);
      const dayKey = d.toISOString().slice(0, 10);
      const climKey = `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      if (!dayBuckets.has(dayKey)) {
          dayBuckets.set(dayKey, {flows: [], climKey, date: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))});
      }
      dayBuckets.get(dayKey).flows.push(averageFlow[i]);
  });

  const dailyDatetime = [];
  const anomaly = [];

  for (const {flows, climKey, date} of dayBuckets.values()) {
    const dayAvg = flows.reduce((a, b) => a + b, 0) / flows.length;
    const clim = dailyAvgs.get(climKey) ?? 0;
    dailyDatetime.push(date);
    anomaly.push(parseFloat((dayAvg - clim).toFixed(3)));
  }

  return {datetime: dailyDatetime, anomaly};
};
/**
 * buildBulletinData
 *
 * Convenience wrapper — runs all computations for one river and returns
 * everything needed to render the bulletin page.
 *
 * @param {Object} riverData - { riverId, forecast, returnPeriods, retrospective }
 * @returns {Object} all derived values for rendering
 */
export const buildBulletinData = ({riverData}) => {
  const {forecast, returnPeriods, retrospective} = riverData;

  // 1. Exceedance probabilities from raw ensemble members
  const exceedance = computeExceedanceProbabilities({
    discharge: forecast.discharge,
    datetime: forecast.datetime,
    returnPeriods,
  });

  // 2. Alert classifications
  const ensembleAlert = classifyAlertEnsemble({exceedance});
  const medianAlert = classifyAlertMedian({
    medianFlow: forecast.stats.median,
    datetime: forecast.datetime,
    returnPeriods,
  });
  const overallAlert = classifyOverallAlert({ensembleAlert, medianAlert});

  // 3. Summary statistics
  const peakFlow = Math.max(...forecast.stats.max);
  const meanFlow = forecast.stats.average.reduce((a, b) => a + b, 0) / forecast.stats.average.length;

  // 4. Anomaly (only if retrospective data was fetched)
  let flowAnomaly = null;
  if (retrospective) {
    const dailyAvgs = computeDailyAverages({
      datetime: retrospective.datetime,
      discharge: retrospective.discharge,
    });
    flowAnomaly = computeFlowAnomaly({
      datetime: forecast.datetime,
      averageFlow: forecast.stats.average,
      dailyAvgs,
    });
  }

  return {
    exceedance,
    ensembleAlert,
    medianAlert,
    overallAlert,
    peakFlow,
    meanFlow,
    flowAnomaly,
  };
};