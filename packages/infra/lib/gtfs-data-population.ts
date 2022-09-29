import { Duration } from "aws-cdk-lib";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { Rule, RuleTargetInput, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AssetCode, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { AwsCustomResource, AwsCustomResourcePolicy, AwsSdkCall, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

export interface GtfsDataPopulationProps {

  // Storage tables
  AgencyTableArn: string;
  CalendarDatesTableArn: string;
  CalendarTableArn: string;
  RoutesTableArn: string;
  StopsTableArn: string;
  StopTimesTableArn: string;
  TripsTableArn: string;

  /**
   * Custom interval for data synchronization
   */
  GtfsDataSynchronizationRate?: Duration;

  /**
   * Custom GTFS data feeds
   */
  GtfsDataFeeds?: string[];
}

/**
 * Provides the system with data-population techniques to download and sync GTFS data to feed the solution
 */
export class GtfsDataPopulationConstruct extends Construct {
  
  // Function to fetch GTFS data
  public readonly dataFetchingFunction: Function;

  // Schedule to keep data in sync
  public readonly dataFetchingSchedule: Rule;

  constructor (scope: Construct, id: string, props: GtfsDataPopulationProps) {
    super(scope, id);

    // Create table references to assign permissions to function
    const agencyTable = Table.fromTableArn(this, 'AgencyTable', props.AgencyTableArn);
    const calendarDatesTable = Table.fromTableArn(this, 'CalendarDatesTable', props.CalendarDatesTableArn);
    const calendarTable = Table.fromTableArn(this, 'CalendarTable', props.CalendarTableArn);
    const routesTable = Table.fromTableArn(this, 'RoutesTable', props.RoutesTableArn);
    const stopsTable = Table.fromTableArn(this, 'StopsTable', props.StopsTableArn);
    const stopTimesTable = Table.fromTableArn(this, 'StopTimesTable', props.StopTimesTableArn);
    const tripsTable = Table.fromTableArn(this, 'TripsTable', props.TripsTableArn);

    // Initialize the function that fetches and populates data
    this.dataFetchingFunction = new Function(this, 'GtfsDataFetchingFunction', {
      code: new AssetCode(`${__dirname}/../../gtfs-data-fetching`),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_16_X,
      environment: {
        AGENCY_TABLE_NAME: agencyTable.tableName,
        CALENDAR_DATES_TABLE_NAME: calendarDatesTable.tableName,
        CALENDAR_TABLE_NAME: calendarTable.tableName,
        ROUTES_TABLE_NAME: routesTable.tableName,
        STOPS_TABLE_NAME: stopsTable.tableName,
        STOP_TIMES_TABLE_NAME: stopTimesTable.tableName,
        TRIPS_TABLE_NAME: tripsTable.tableName,
      },
      memorySize: 1024,
      timeout: Duration.seconds(300)
    });

    // Grant permissions to the function to store data
    this.dataFetchingFunction.addToRolePolicy(new PolicyStatement({
      actions: ['dynamodb:BatchWriteItem'],
      resources: [
        agencyTable.tableArn,
        calendarDatesTable.tableArn,
        calendarTable.tableArn,
        routesTable.tableArn,
        stopsTable.tableArn,
        stopTimesTable.tableArn,
        tripsTable.tableArn,
      ]
    }));

    // Initialize schedule to call function periodically to keep data up to date
    this.dataFetchingSchedule = new Rule(this, 'DataFetchingSchedule', {
      description: 'Calls GTFS data fetching function periodically',
      schedule: Schedule.rate(props?.GtfsDataSynchronizationRate || Duration.days(1)),
      targets: [
        new LambdaFunction(this.dataFetchingFunction, {
          event: RuleTargetInput.fromObject({
            feeds: props?.GtfsDataFeeds || [
              'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
            ]
          })
        })
      ]
    });

    // Call the function upon deployment for the first time
    // to ensure there's data to work with immediately
    // const populateDataAtDeploymentCall: AwsSdkCall = {
    //   service: 'Lambda',
    //   action: 'invokeFunction',
    //   physicalResourceId: PhysicalResourceId.of(`${this.dataFetchingFunction.functionName}_initialization`),
    //   parameters: {
    //     FunctionName: this.dataFetchingFunction.functionName,
    //     Payload: JSON.stringify({
    //       feeds: props?.GtfsDataFeeds || [
    //         'https://ssl.renfe.com/gtransit/Fichero_AV_LD/google_transit.zip',
    //       ]
    //     })
    //   }
    // };

    // new AwsCustomResource(this, 'DataInitialization', {
    //   policy: AwsCustomResourcePolicy.fromStatements([
    //     new PolicyStatement({
    //       actions: ['lambda:Invoke'],
    //       resources: [
    //         this.dataFetchingFunction.functionArn
    //       ]
    //     })
    //   ]),
    //   onCreate: populateDataAtDeploymentCall,
    //   onUpdate: populateDataAtDeploymentCall
    // });
  }
}