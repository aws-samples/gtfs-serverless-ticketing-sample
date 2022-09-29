import { DynamoDB } from 'aws-sdk';
import { Extract } from 'unzip-stream';
import { Logger } from '@aws-lambda-powertools/logger';
import { createReadStream } from 'fs';
import https from 'https';
import { parse } from 'fast-csv';

export interface GtfsDataFetchingEvent {

  /**
   * List of GTFS feeds to get transit information from
   */
  feeds: string[];
}

// Get table names from env variables
const agencyTableName = process.env.AGENCY_TABLE_NAME!;
const calendarDatesTableName = process.env.CALENDAR_DATES_TABLE_NAME!;
const calendarTableName = process.env.CALENDAR_TABLE_NAME!;
const routesTableName = process.env.ROUTES_TABLE_NAME!;
const stopsTableName = process.env.STOPS_TABLE_NAME!;
const stopTimesTableName = process.env.STOP_TIMES_TABLE_NAME!;
const tripsTableName = process.env.TRIPS_TABLE_NAME!;

const ddb = new DynamoDB.DocumentClient();
const Log = new Logger();

export const handler = async (event: GtfsDataFetchingEvent) => {

  Log.info('Starting GTFS data fetching function', {
    Feeds: event.feeds
  });
  
  // Get Feed URLs from the event
  const feeds = event.feeds;

  // Download each feed, unzip it, and load its contents
  await Promise.all(feeds.map(async (feed: string) => {

    Log.info('Processing feed', { FeedUrl: feed });

    // Download feed contents
    Log.debug('Downloading feed contents');
    await new Promise((resolve) => {
      const contents = https.get(feed, (response) => {
        response.pipe(Extract({ path: '/tmp/gtfs-data' }))
        .on('close', () => {
          resolve(null);
        });
      });
    });

    // Read files
    Log.debug('Reading file contents');
    const agencyFile = await parseCsvFile('/tmp/gtfs-data/agency.txt');
    const calendarDatesFile = await parseCsvFile('/tmp/gtfs-data/calendar_dates.txt');
    const calendarFile = await parseCsvFile('/tmp/gtfs-data/calendar.txt');
    const routesFile = await parseCsvFile('/tmp/gtfs-data/routes.txt');
    const stopTimesFile = await parseCsvFile('/tmp/gtfs-data/stop_times.txt');
    const stopsFile = await parseCsvFile('/tmp/gtfs-data/stops.txt');
    const tripsFile = await parseCsvFile('/tmp/gtfs-data/trips.txt');

    // Store contents
    Log.info('Storing items');
    await Promise.all([
      storeData(agencyTableName, agencyFile),
      storeData(calendarDatesTableName, calendarDatesFile),
      storeData(calendarTableName, calendarFile),
      storeData(routesTableName, routesFile),
      storeData(stopTimesTableName, stopTimesFile),
      storeData(stopsTableName, stopsFile),
      storeData(tripsTableName, tripsFile),
    ]);

  }));
};

/**
 * Parses a CSV file from a GTFS feed and returns data as objects
 * @param filePath Path of the CSV file to read
 * @returns A parsed object with the CSV data
 */
export async function parseCsvFile(filePath: string): Promise<{ [key: string]: any }[]> {
  Log.debug('Parsing CSV file', { FileName: filePath });

  return new Promise((resolve, reject) => {
    const parsedData: any[] = [];

    // Open file
    createReadStream(filePath)
      .pipe(parse({ headers: true, trim: true }))
      .on('error', (error) => reject(error))
      .on('data', (row) => parsedData.push(row))
      .on('end', (rowCount: number) => {
        Log.debug(`Parsed ${rowCount} rows`);
        resolve(parsedData)
      });
  });
}

/**
 * Stores a given array of items into a DynamoDB table
 * @param tableName Name of the table where to store the data
 * @param contents Array of items to store in the table
 */
export async function storeData (tableName: string, contents: any[]): Promise<void> {

  Log.debug('Storing data in dynamo', {
    TableName: tableName,
    RowCount: contents.length
  });

  // Prepare chunks for storage. DynamoDB only allows for 25 items to be stored at once
  Log.debug('Preparing chunks for storage');
  const chunks = [];
  for (let i = 0; i < contents.length; i += 25) {
    chunks.push(contents.slice(i, Math.min(i+25, contents.length)));
  }

  // Store data
  Log.debug('Storing data', { ChunkCount: chunks.length });

  // Do requests sequentially to avoid throttling the DB
  // 40 means 1000 requests simultaneously
  for (let i = 0; i < chunks.length; i += 40) {
    const targetChunks = chunks.slice(i, Math.min(chunks.length, i + 40));
    await Promise.all(targetChunks.map(async chunk => {
      const response = await ddb.batchWrite({
        RequestItems: {
          [tableName]: chunk.map(Item => ({
            PutRequest: {
              Item
            }
          }))
        }
      }).promise();

      // Verify if there were throttled records
      if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length) {
        Log.error('There were unprocessed requests');
        Log.debug('Failed requests', { ThrottledRequests: response.UnprocessedItems[tableName].length });
      }
    })); 
  }

  Log.debug('All records stored successfully');
}
