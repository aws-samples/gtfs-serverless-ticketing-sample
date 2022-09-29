import { AuthorizationType, AwsIntegration, LambdaIntegration, PassthroughBehavior, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Table } from "aws-cdk-lib/aws-dynamodb";
import { HttpMethod } from "aws-cdk-lib/aws-events";
import { AssetCode, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export interface SearchStopsApiResourceProps {
  Api: RestApi;
  StopsTableArn: string;
}

export class SearchStopsApiResourceConstruct extends Construct {
  /**
   * Function to search for stops
   */
  public readonly searchStopsFunction: Function;

  constructor (scope: Construct, id: string, props: SearchStopsApiResourceProps) {
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

    const stopsTable = Table.fromTableArn(this, 'StopsTable', props.StopsTableArn);

    // Create function to search for stops
    this.searchStopsFunction = new Function(this, 'SearchStopsFunction', {
      code: new AssetCode(`${__dirname}/../../api-backend-search-stops`),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_16_X,
      environment: {
        STOPS_TABLE_NAME: stopsTable.tableName
      },
    });
    // Grant function access to stops table
    stopsTable.grantReadData(this.searchStopsFunction);

    // Add resource to search for stops
    const stopsResource = props.Api.root.addResource('stops');

    // Allow searching for stops
    stopsResource.addMethod(HttpMethod.GET, new LambdaIntegration(this.searchStopsFunction, {
      proxy: false,
      passthroughBehavior: PassthroughBehavior.WHEN_NO_TEMPLATES,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: integrationResponseParameters
        }
      ],
      requestTemplates: {
        'application/json': JSON.stringify({
          FilterText: `$input.params('filter')`
        })
      }
    }), {
      authorizationType: AuthorizationType.IAM,
      requestParameters: {
        'method.request.querystring.filter': true
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: methodResponseParameters
        }
      ]
    });
  }
}