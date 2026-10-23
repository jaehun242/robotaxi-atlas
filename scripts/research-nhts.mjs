// Reproduce national MSA-size proxies from official public 2022 NHTS microdata.
// No API key or dependencies. This is an explicit research run, not a daily statistic.
import { inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const url = 'https://nhts.ornl.gov/media/2022/download/csv.zip';
const output = new URL('../data/nhts-2022-proxy.json', import.meta.url);
const archiveLimit = 10 * 1024 * 1024;

async function download() {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) {
        const error = new Error(`NHTS HTTP ${response.status}`);
        error.noRetry = [401, 403, 404].includes(response.status);
        throw error;
      }
      if (Number(response.headers.get('content-length')) > archiveLimit) throw new Error('NHTS archive too large');
      const chunks = [];
      let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > archiveLimit) throw new Error('NHTS archive too large');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (error.noRetry || attempt === 2) throw error;
    }
  }
}

// Only read the two named CSV files in memory. Never extract archive paths to disk.
function unzipCsv(buffer) {
  let end = buffer.length - 22;
  const minimum = Math.max(0, buffer.length - 65557);
  while (end >= minimum && buffer.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < minimum) throw new Error('Invalid ZIP directory');
  let position = buffer.readUInt32LE(end + 16);
  const files = {};
  while (position + 46 <= buffer.length && buffer.readUInt32LE(position) === 0x02014b50) {
    const method = buffer.readUInt16LE(position + 10);
    const size = buffer.readUInt32LE(position + 20);
    const uncompressedSize = buffer.readUInt32LE(position + 24);
    const nameLength = buffer.readUInt16LE(position + 28);
    const extraLength = buffer.readUInt16LE(position + 30);
    const commentLength = buffer.readUInt16LE(position + 32);
    const offset = buffer.readUInt32LE(position + 42);
    const name = buffer.subarray(position + 46, position + 46 + nameLength).toString();
    if (['hhv2pub.csv', 'tripv2pub.csv'].includes(name)) {
      if (uncompressedSize > 32 * 1024 * 1024 || ![0, 8].includes(method)) throw new Error('Unexpected ZIP entry');
      if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP entry');
      const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
      if (start + size > buffer.length) throw new Error('Truncated ZIP entry');
      const bytes = buffer.subarray(start, start + size);
      const data = method === 8 ? inflateRawSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }) : bytes;
      if (data.length !== uncompressedSize) throw new Error('Unexpected ZIP entry size');
      files[name] = data.toString('utf8');
    }
    position += 46 + nameLength + extraLength + commentLength;
  }
  if (!files['hhv2pub.csv'] || !files['tripv2pub.csv']) throw new Error('Required NHTS CSV files missing');
  return files;
}

// Public-use inputs are numeric columns with quoted header names, without text fields.
function numericRows(text, required) {
  const lines = text.trim().split(/\r?\n/);
  const columns = lines.shift().split(',').map(cell => cell.replace(/^"|"$/g, ''));
  if (required.some(name => !columns.includes(name))) throw new Error('NHTS schema changed');
  return lines.map(line => {
    const cells = line.split(',').map(cell => cell.replace(/^"|"$/g, ''));
    if (cells.length !== columns.length) throw new Error('Unexpected NHTS CSV field count');
    const row = {};
    for (const name of required) {
      const raw = cells[columns.indexOf(name)];
      if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`NHTS nonnumeric ${name}`);
      row[name] = Number(raw);
    }
    return row;
  });
}

function aggregate(households, trips, name, codes) {
  const included = row => codes === null || codes.includes(row.MSASIZE);
  const hh = households.filter(included);
  const tt = trips.filter(included);
  const householdWeight = hh.reduce((sum, row) => sum + row.WTHHFIN, 0);
  const mode = modeCodes => {
    const rows = tt.filter(row => modeCodes.includes(row.TRPTRANS));
    const annualPersonTrips = rows.reduce((sum, row) => sum + row.WTTRDFIN, 0);
    const timed = rows.filter(row => row.TRVLCMIN >= 0);
    const timeWeight = timed.reduce((sum, row) => sum + row.WTTRDFIN, 0);
    return {
      modeCodes,
      unweightedTripRecords: rows.length,
      annualPersonTrips,
      personTripsPerHouseholdPerDay: annualPersonTrips / householdWeight / 365,
      averageTripMinutes: timed.reduce((sum, row) => sum + row.WTTRDFIN * row.TRVLCMIN, 0) / timeWeight,
      timedTripRecords: timed.length,
      missingTimeTripRecords: rows.length - timed.length,
    };
  };
  return {
    name,
    msaSizeCodes: codes,
    householdSampleCount: hh.length,
    weightedHouseholds: householdWeight,
    taxiAndRidehail: mode([15, 16]),
    privateCarVanSuvPickup: mode([1, 2, 3, 4]),
  };
}

const archive = await download();
const files = unzipCsv(archive);
const households = numericRows(files['hhv2pub.csv'], ['MSASIZE', 'WTHHFIN']);
const trips = numericRows(files['tripv2pub.csv'], ['MSASIZE', 'TRPTRANS', 'WTTRDFIN', 'TRVLCMIN']);
if (households.some(row => row.WTHHFIN < 0) || trips.some(row => row.WTTRDFIN < 0)) throw new Error('Negative survey weights');
const research = {
  schemaVersion: 1,
  dataset: '2022 National Household Travel Survey public-use CSV V2.1',
  release: 'April 2025',
  statisticalYear: 2022,
  collectedTravelPeriod: 'January 2022 through January 2023',
  retrievedAt: new Date().toISOString(),
  sourceUrl: url,
  downloadPage: 'https://nhts.ornl.gov/downloads',
  codebookUrl: 'https://nhts.ornl.gov/media/2022/doc/codebook.pdf',
  codebookPages: { householdMsaSize: 6, tripModeAndTime: 58, tripWeights: 62 },
  userGuideUrl: 'https://nhts.ornl.gov/documentation',
  archiveBytes: archive.length,
  archiveSha256: createHash('sha256').update(archive).digest('hex'),
  householdSampleCount: households.length,
  tripSampleCount: trips.length,
  units: {
    annualPersonTrips: 'weighted person trips/year, not paid vehicle rides',
    weightedHouseholds: 'households, WTHHFIN 7-day national household weight',
    dailyRate: 'person trips per household per calendar day',
    tripTime: 'WTTRDFIN-weighted mean TRVLCMIN, minutes per person trip; negative/missing times excluded',
  },
  derivation: [
    'Group household and trip files using the same MSASIZE category.',
    'Sum WTTRDFIN for TRPTRANS 15 (taxicab/limo) and 16 (other ride-sharing). These are annual person-trip weights.',
    'Divide annual person trips by sum(WTHHFIN) for all households in that category and by 365.',
    'Private-car expansion pool uses only TRPTRANS 1 car, 2 van, 3 SUV/crossover, 4 pickup; it excludes taxi/TNC, walking, cycling and transit.',
    'A city proxy can multiply its separately sourced ACS household count by this national MSA-category rate. This is a derived proxy, not a local observation.',
    'Converting person trips to paid vehicle rides requires an explicit occupancy assumption, not supplied by this file.',
  ],
  caveats: [
    'National MSA-size proxy based on household home geography, not trips entirely within a city or geofenced Tesla service area.',
    '2022 pandemic-recovery behavior; not a measurement of current 2026 taxi/TNC demand.',
    'Taxi/TNC trip records are few (33 in 1M–<3M and 61 in 3M+); the point estimates have sampling uncertainty. No confidence bounds are claimed.',
    'NHTS person travel covers household members age 5 and older; a household-count denominator avoids silently multiplying a 5+ person rate by all-age Census population.',
    'Travel by household residents can occur outside the home city; tourists, nonresident commuters and airport traffic are not independently measured. Do not add them without proving non-overlap.',
    'Rates for private vehicles and taxi/TNC come from mutually exclusive primary mode codes. Do not interpret private-vehicle passenger trips as separate vehicle rides.',
    'Average trip duration is a demand proxy, not autonomous vehicle productivity. Pickup, empty travel, charging, cleaning, maintenance and downtime need separate analytic assumptions.',
    'MSASIZE is a survey-era category. Applying its rate to a present city is an analytic substitution, not a reclassification of NHTS respondents.',
  ],
  bands: [
    aggregate(households, trips, 'National all households', null),
    aggregate(households, trips, 'National MSA/CMSA population 1,000,000–2,999,999', [4]),
    aggregate(households, trips, 'National MSA/CMSA population 3,000,000 or more', [5]),
  ],
};
if (process.argv.includes('--dry-run')) console.log(JSON.stringify(research, null, 2));
else {
  await writeFile(output, `${JSON.stringify(research, null, 2)}\n`, 'utf8');
  console.log(`Saved ${research.householdSampleCount} households / ${research.tripSampleCount} trip records; SHA256 ${research.archiveSha256}`);
}
