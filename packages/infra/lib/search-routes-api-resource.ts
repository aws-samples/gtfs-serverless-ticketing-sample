import { Duration } from "aws-cdk-lib";
import { AuthorizationType, AwsIntegration, LambdaIntegration, PassthroughBehavior, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { HttpMethod } from "aws-cdk-lib/aws-events";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { AssetCode, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface SearchRoutesApiResourceProps {
  Api: RestApi;
  
  CalendarTableArn: string;
  CalendarDatesTableArn: string;
  RoutesTableArn: string;
  StopTimesTableArn: string;
  TripsTableArn: string;
}

export class SearchRoutesApiResourceConstruct extends Construct {
  /**
   * Function to search for routes
   */
  public readonly searchRoutesFunction: Function;

  constructor (scope: Construct, id: string, props: SearchRoutesApiResourceProps) {
    super(scope, id);

    const integrationResponseParameters = {
      'method.response.header.access-control-allow-origin': `'*'`,
      'method.response.header.access-control-allow-headers': `'*'`,
      'method.response.header.access-control-allow-methods': `'*'`,
      'method.response.header.access-control-allow-credentials': `'true'`,
    }

    const methodResponseParameters = {
      'method.response.header.access-control-allow-origin': true,
      'method.response.header.access-control-allow-headers': true,
      'method.response.header.access-control-allow-methods': true,
      'method.response.header.access-control-allow-credentials': true
    }

    // Import required tables
    const calendarTable = Table.fromTableArn(this, 'CalendarTable', props.CalendarTableArn);
    const calendarDatesTable = Table.fromTableArn(this, 'CalendarDatesTable', props.CalendarDatesTableArn);
    const routesTable = Table.fromTableArn(this, 'RoutesTable', props.RoutesTableArn);
    const stopTimesTable = Table.fromTableArn(this, 'StopTimesTable', props.StopTimesTableArn);
    const tripsTable = Table.fromTableArn(this, 'TripsTable', props.TripsTableArn);

    // Create function to search for routes
    this.searchRoutesFunction = new Function(this, 'SearchRoutesFunction', {
      code: new AssetCode(`${__dirname}/../../api-backend-search-routes`),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_16_X,
      environment: {
        CALENDAR_TABLE_NAME: calendarTable.tableName,
        CALENDAR_DATES_TABLE_NAME: calendarDatesTable.tableName,
        ROUTES_TABLE_NAME: routesTable.tableName,
        STOP_TIMES_TABLE_NAME: stopTimesTable.tableName,
        TRIPS_TABLE_NAME: tripsTable.tableName
      },
      memorySize: 1024,
      timeout: Duration.seconds(10)
    });

    // Grant function access to routes table
    this.searchRoutesFunction.addToRolePolicy(new PolicyStatement({
      actions: [
        'dynamodb:Query',
        'dynamodb:BatchGetItem'
      ],
      resources: [
        calendarTable.tableArn,
        calendarDatesTable.tableArn,
        routesTable.tableArn,
        stopTimesTable.tableArn,
        `${stopTimesTable.tableArn}/index/ByStopId`,
        tripsTable.tableArn
      ]
    }));

    // Add resource to search for routes
    const routesResource = props.Api.root.addResource('routes');

    // Allow searching for routes
    routesResource.addMethod(HttpMethod.GET, new LambdaIntegration(this.searchRoutesFunction, {
      proxy: false,
      passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: integrationResponseParameters
        },
        {
          statusCode: '404',
          responseParameters: integrationResponseParameters,
          selectionPattern: 'NOT_FOUND_EXCEPTION'
        }
      ],
      requestTemplates: {
        'application/json': JSON.stringify({
          OriginStopId: `$input.params('origin')`,
          DestinationStopId: `$input.params('destination')`,
          OutboundDate: `$input.params('outbound_date')`,
          InboundDate: `$input.params('inbound_date')`,
          WheelchairSeating: `$input.params('wheelchair_seating')`,
        })
      },
    }), {
      authorizationType: AuthorizationType.IAM,
      requestParameters: {
        'method.request.querystring.origin': true,
        'method.request.querystring.destination': true,
        'method.request.querystring.outbound_date': true,
        'method.request.querystring.inbound_date': true,
        'method.request.querystring.wheelchair_seating': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: methodResponseParameters
        },
        {
          statusCode: '404',
          responseParameters: methodResponseParameters
        }
      ]
    });
  }
}