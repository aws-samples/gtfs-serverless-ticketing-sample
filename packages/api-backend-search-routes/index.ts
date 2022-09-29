import { DynamoDB } from 'aws-sdk';
import { Logger } from '@aws-lambda-powertools/logger';
import moment from 'moment';

export interface ApiSearchStopsEvent {
  OriginStopId: string;
  DestinationStopId: string;
  OutboundDate: string;
  InboundDate?: string;
  WheelchairSeating?: boolean;

  // TODO Ticket count and promo codes?
}

// Get table name from env variables
const calendarTableName = process.env.CALENDAR_TABLE_NAME!;
const calendarDatesTableName = process.env.CALENDAR_DATES_TABLE_NAME!;
const routesTableName = process.env.ROUTES_TABLE_NAME!;
const stopTimesTableName = process.env.STOP_TIMES_TABLE_NAME!;
const tripsTableName = process.env.TRIPS_TABLE_NAME!;

const ddb = new DynamoDB.DocumentClient();
const Log = new Logger();

export const handler = async (event: ApiSearchStopsEvent) => {
  Log.info('Starting search routes function', { Event: event });

  // Find trips that pass by the selected origin
  Log.debug('Finding trips with selected origin', { OriginId: event.OriginStopId });
  const originTripsResponse = await ddb.query({
    TableName: stopTimesTableName,
    IndexName: 'ByStopId',
    KeyConditionExpression: '#stopId = :stopId',
    ExpressionAttributeNames: {
      '#stopId': 'stop_id'
    },
    ExpressionAttributeValues: {
      ':stopId': event.OriginStopId
    },
    ProjectionExpression: 'trip_id,stop_id,arrival_time,departure_time,stop_sequence',
  }).promise();

  const originTrips = originTripsResponse.Items!;

  // Find trips that pass by the selected destination
  Log.debug('Finding trips with selected destination', { OriginId: event.DestinationStopId });
  const destinationTripsResponse = await ddb.query({
    TableName: stopTimesTableName,
    IndexName: 'ByStopId',
    KeyConditionExpression: '#stopId = :stopId',
    ExpressionAttributeNames: {
      '#stopId': 'stop_id'
    },
    ExpressionAttributeValues: {
      ':stopId': event.DestinationStopId
    },
    ProjectionExpression: 'trip_id,stop_id,arrival_time,departure_time,stop_sequence',
  }).promise();

  const destinationTrips = destinationTripsResponse.Items!;
  
  // Filter trips and get only those that pass both by origin and destination
  Log.debug('Correlating origin trips with destinations', { 
    OriginTripCount: originTrips.length,
    DestinationTripCount: destinationTrips.length
  });
  const matchingTrips = destinationTrips.filter((trip: any) => !!originTrips.find((t: any) => t.trip_id === trip.trip_id));
  Log.debug('Correlation finished', { MatchingTripCount: matchingTrips.length });

  // Filter by correct sequence order (origin before destination)
  Log.debug('Filtering trips by stop sequence');
  const directionalTrips = matchingTrips.filter((destination: any) => {
    // Get origin
    const origin = originTrips.find((t: any) => t.trip_id === destination.trip_id);
    if (!origin) {
      Log.error('There is no origin trip to correlate to', { DestinationTripId: destination.trip_id });
      // TODO Throw exception
    }

    // Accept item only if origin comes before destination
    return origin!.stop_sequence < destination.stop_sequence;
  });

  // If there is no trip found, return the error
  if (!directionalTrips.length) {
    Log.error('No trips were found. Stopping execution.');
    throw 'NOT_FOUND_EXCEPTION';
  }

  // Get trip ids
  const matchingTripIds = directionalTrips.map((trip: any) => trip.trip_id);

  // Fetch information about target trips
  Log.info('Fetching matching trips', { MatchingTripIds: matchingTripIds });
  const tripChunks = [];
  for (let i = 0; i < matchingTripIds.length; i += 100) {
    tripChunks.push(matchingTripIds.slice(i, Math.min(matchingTripIds.length, i + 100)));
  }

  // Get information about trip routes
  const matchingTripsData = (await Promise.all(tripChunks.map(async chunk => {
    return (await ddb.batchGet({
      RequestItems: {
        [tripsTableName]: {
          Keys: chunk.map((trip_id: string) => ({
            trip_id
          }))
        }
      }
    }).promise()).Responses![tripsTableName];
  }))).flat();
  
  Log.debug('Trips fetched', { MatchingTripCount: matchingTripsData.length });

  // Remove duplicate route and service IDs
  const servicesWithoutDuplicates = Object.values(matchingTripsData.map((t: any) => ({ [t.service_id]: t })).reduce((t: any, i: any) => ({ ...t, ...i })));
  const routesWithoutDuplicates = Object.values(matchingTripsData.map((t: any) => ({ [t.route_id]: t })).reduce((t: any, i: any) => ({ ...t, ...i })));

  const targetDate = moment(event.OutboundDate);
  const formattedOutboundDate = targetDate.format('YYYYMMDD');
  Log.debug('Fetching data for matching trips', { Date: formattedOutboundDate });

  const serviceChunks: any[] = [];
  const routeChunks: any = [];
  for (let i = 0; i < matchingTripIds.length; i += 100) {
    serviceChunks.push(servicesWithoutDuplicates.slice(i, Math.min(servicesWithoutDuplicates.length, i + 100)));
    routeChunks.push(routesWithoutDuplicates.slice(0, Math.min(routesWithoutDuplicates.length, 100)));
  }

  // Get calendar information for selected services
  const matchingCalendarEntries = (await Promise.all(serviceChunks.map(async chunk => {
    return (await ddb.batchGet({
      RequestItems: {
        [calendarTableName]: {
          Keys: chunk.map((service: any) => ({
            service_id: service.service_id
          }))
        }
      }
    }).promise()).Responses![calendarTableName];
  })))
    .flat()
    .filter(entry => {
      const start_date = moment(entry.start_date, 'YYYYMMDD');
      const end_date = moment(entry.end_date, 'YYYYMMDD');

      return start_date <= targetDate && targetDate <= end_date;
    })

  const uniqueServicesIds = Object.keys(matchingCalendarEntries
    .map((entry: any) => ({ [entry.service_id]: entry }))
    .reduce((t: any, i: any) => ({ ...t, ...i })));
  let matchingCalendarDates: any = [], matchingRoutes: any[] = [];

  await Promise.all([
    new Promise(async (resolve) => {
      matchingCalendarDates = (await Promise.all([uniqueServicesIds].map(async chunk => {
        return (await ddb.batchGet({
          RequestItems: {
            [calendarDatesTableName]: {
              Keys: chunk.map((service_id: any) => ({
                service_id,
                date: formattedOutboundDate
              }))
            }
          }
        }).promise()).Responses![calendarDatesTableName];
      }))).flat();
      resolve(null);
    }),
    new Promise(async (resolve) => {
      matchingRoutes = (await Promise.all(routeChunks.map(async (chunk: any) => {
        return (await ddb.batchGet({
          RequestItems: {
            [routesTableName]: {
              Keys: chunk.map((trip: any) => ({
                route_id: trip.route_id,
              }))
            }
          }
        }).promise()).Responses![routesTableName];
      }))).flat();
      resolve(null);
    })
  ]);

  // Get itineraries 
  const filteredTrips = matchingTripsData.filter(t => uniqueServicesIds.indexOf(t.service_id) !== -1);
  Log.debug('Fetching itineraries of matching trips');
  const matchingItineraries = (await Promise.all(filteredTrips.map(async (trip: any) => {

    // Fetch itinerary for trip
    const itinerary = await ddb.query({
      TableName: stopTimesTableName,
      KeyConditionExpression: '#tripId = :tripId',
      ExpressionAttributeNames: {
        '#tripId': 'trip_id'
      },
      ExpressionAttributeValues: {
        ':tripId': trip.trip_id
      }
    }).promise();

    return { [trip.trip_id]: itinerary.Items };
  }))).reduce((t: any, i: any) => ({ ...t, ...i }));

  // Compile results
  Log.info('Compiling results data');
  const result = filteredTrips.map((trip: any) => ({
    Route: matchingRoutes.find((route: any) => route.route_id === trip.route_id),
    Trip: trip,
    ServiceException: matchingCalendarDates.find((service: any) => service.service_id === trip.service_id),
    Calendar: matchingCalendarEntries.find((service: any) => service.service_id === trip.service_id),
    Itinerary: matchingItineraries[trip.trip_id]
  }));

  return result;
}
