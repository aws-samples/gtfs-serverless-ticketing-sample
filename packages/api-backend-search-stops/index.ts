import { DynamoDB } from 'aws-sdk';
import { Logger } from '@aws-lambda-powertools/logger';

export interface ApiSearchStopsEvent {

  FilterText?: string;
}

// Get table name from env variables
const stopsTableName = process.env.STOPS_TABLE_NAME!;

const ddb = new DynamoDB.DocumentClient();
const Log = new Logger();

export const handler = async (event: ApiSearchStopsEvent) => {
  Log.info('Starting search stops function', { Event: event });

  // Read stops table
  Log.debug('Reading table');
  const stopsResponse = await ddb.scan({
    TableName: stopsTableName
  }).promise();

  const items = stopsResponse.Items!;
  let filteredItems = items;

  // If user has specified some text in the filter, filter stops
  if (!!event.FilterText) {
    filteredItems = items.filter((i: any) => !!i.stop_name.match(new RegExp(event.FilterText!, 'i')));
  }

  return filteredItems;
}
