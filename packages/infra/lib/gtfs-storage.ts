import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

export interface GTFSStorageProps {

}

/**
 * Provides the system with a storage module to save GTFS data to service the solution
 */
export class GtfsStorageConstruct extends Construct {

  // Store GTFS data
  public readonly agencyTable: Table;
  public readonly calendarDatesTable: Table;
  public readonly calendarTable: Table;
  public readonly routesTable: Table;
  public readonly stopsTable: Table;
  public readonly stopTimesTable: Table;
  public readonly tripsTable: Table;
  
  constructor (scope: Construct, id: string, props?: GTFSStorageProps) {
    super(scope, id);

    // Initialize agency table
    this.agencyTable = new Table(this, 'AgencyTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'agency_id',
        type: AttributeType.STRING
      }
    });

    // Initialize calendar dates table
    this.calendarDatesTable = new Table(this, 'CalendarDatesTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'service_id',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'date',
        type: AttributeType.STRING
      }
    });

    // Initialize calendar table
    this.calendarTable = new Table(this, 'CalendarTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'service_id',
        type: AttributeType.STRING
      }
    });

    // Initialize routes table
    this.routesTable = new Table(this, 'RoutesTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'route_id',
        type: AttributeType.STRING
      }
    });

    // Initialize stop times table
    this.stopTimesTable = new Table(this, 'StopTimesTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'trip_id',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'stop_id',
        type: AttributeType.STRING
      }
    });

    // Enable system to query by stops directly
    this.stopTimesTable.addGlobalSecondaryIndex({
      indexName: 'ByStopId',
      partitionKey: {
        name: 'stop_id',
        type: AttributeType.STRING
      },
      sortKey: {
        name: 'trip_id',
        type: AttributeType.STRING
      }
    });

    // Initialize stop times table
    this.stopsTable = new Table(this, 'StopsTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'stop_id',
        type: AttributeType.STRING
      }
    });

    // Initialize trips table
    this.tripsTable = new Table(this, 'TripsTable', {
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: 'trip_id',
        type: AttributeType.STRING
      }
    });
  }
}