import { Aws, CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { MethodLoggingLevel, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { GtfsDataPopulationConstruct } from './gtfs-data-population';
import { GtfsStorageConstruct } from './gtfs-storage';
import { SearchRoutesApiResourceConstruct } from './search-routes-api-resource';
import { SearchStopsApiResourceConstruct } from './search-stops-api-resource';
import { WebUiConstruct } from './web-ui';

export class GtfsTicketingSampleStack extends Stack {

  /**
   * Storage for GTFS data
   */
  public readonly gtfsStorage: GtfsStorageConstruct;

  /**
   * Populate gtfs table with desired data upon stack creation
   */
  public readonly gtfsDataPopulation: GtfsDataPopulationConstruct;

  /**
   * Rest API to enable requests
   */
  public readonly api: RestApi;

  /**
   * API resource to search for stops
   */
  public readonly searchStopsApiResource: SearchStopsApiResourceConstruct;

  /**
   * API resource to search for routes
   */
  public readonly searchRoutesApiResource: SearchRoutesApiResourceConstruct;

  /**
   * Web UI component to visually interact with the system
   */
  public readonly webUi: WebUiConstruct;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Initialize GTFS storage construct
    this.gtfsStorage = new GtfsStorageConstruct(this, 'GtfsStorage');

    // Initialize data population features
    this.gtfsDataPopulation = new GtfsDataPopulationConstruct(this, 'GtfsDataPopulation', {
      AgencyTableArn: this.gtfsStorage.agencyTable.tableArn,
      CalendarDatesTableArn: this.gtfsStorage.calendarDatesTable.tableArn,
      CalendarTableArn: this.gtfsStorage.calendarTable.tableArn,
      RoutesTableArn: this.gtfsStorage.routesTable.tableArn,
      StopsTableArn: this.gtfsStorage.stopsTable.tableArn,
      StopTimesTableArn: this.gtfsStorage.stopTimesTable.tableArn,
      TripsTableArn: this.gtfsStorage.tripsTable.tableArn,

      // If you want to customize the GTFS data sources for the project, uncomment this:
      // GtfsDataFeeds: [] // List of URLs with GTFS zip files

      // By default the sync cycle is ran every 24h.
      // If you want to run it at a different pace, uncomment this:
      // GtfsDataSynchronizationRate: Duration.days(42)
    });

    // Initialize search API
    this.api = new RestApi(this, 'SearchApi', {
      defaultCorsPreflightOptions: {
        allowOrigins: ['*'],
        allowCredentials: true,
        allowHeaders: ['*'],
        allowMethods: ['*'],
      },
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
      }
    });
    
    // Search for stops
    this.searchStopsApiResource = new SearchStopsApiResourceConstruct(this, 'SearchStopsApiResource', {
      Api: this.api,
      StopsTableArn: this.gtfsStorage.stopsTable.tableArn
    });

    // Search for routes
    this.searchRoutesApiResource = new SearchRoutesApiResourceConstruct(this, 'SearchRoutesApiResource', {
      Api: this.api,
      CalendarTableArn: this.gtfsStorage.calendarTable.tableArn,
      CalendarDatesTableArn: this.gtfsStorage.calendarDatesTable.tableArn,
      RoutesTableArn: this.gtfsStorage.routesTable.tableArn,
      StopTimesTableArn: this.gtfsStorage.stopTimesTable.tableArn,
      TripsTableArn: this.gtfsStorage.tripsTable.tableArn
    });

    // Initialize web ui
    this.webUi = new WebUiConstruct(this, 'WebUi', {
      SearchApiId: this.api.restApiId,
      SearchApiRootResourceId: this.api.restApiRootResourceId
    });

    // Add some generic outputs to enable local testing
    new CfnOutput(this, 'AwsAccountId', { value: Aws.ACCOUNT_ID });
    new CfnOutput(this, 'AwsRegion', { value: Aws.REGION });
    new CfnOutput(this, 'SearchApiUrl', { value: this.api.url });
  }
}
