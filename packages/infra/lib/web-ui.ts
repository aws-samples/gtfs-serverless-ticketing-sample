import { CfnOutput, Duration, RemovalPolicy } from "aws-cdk-lib";
import { RestApi } from "aws-cdk-lib/aws-apigateway";
import { CachePolicy, Distribution, OriginAccessIdentity, PriceClass, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CfnIdentityPool, CfnIdentityPoolRoleAttachment } from "aws-cdk-lib/aws-cognito";
import { CanonicalUserPrincipal, FederatedPrincipal, PolicyStatement, Role } from "aws-cdk-lib/aws-iam";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface WebUiProps {
  SearchApiId: string;
  SearchApiRootResourceId: string;
}

export class WebUiConstruct extends Construct {

  /**
   * Identity pool to grant web ui users access to API
   */
  public readonly authIdentityPool: CfnIdentityPool;

  /**
   * Role to grant public users in the website
   */
  public readonly guestUsersRole: Role;

  /**
   * S3 bucket to store the UI
   */
  public readonly websiteBucket: Bucket;

  /**
   * Security profile for 
   */
  public readonly websiteOriginAccessIdentity: OriginAccessIdentity;

  /**
   * Cloudfront distribution to distribute the UI
   */
  public readonly websiteDistribution: Distribution;

  constructor (scope: Construct, id: string, props: WebUiProps) {
    super(scope, id);

    const searchApi = RestApi.fromRestApiAttributes(this, 'SearchApi', { restApiId: props.SearchApiId, rootResourceId: props.SearchApiRootResourceId });

    // Initialize identity pool
    this.authIdentityPool = new CfnIdentityPool(this, 'Identities', {
      allowUnauthenticatedIdentities: true,
    });

    // Initialize role
    this.guestUsersRole = new Role(this, 'GuestUsersRole', {
      assumedBy: new FederatedPrincipal('cognito-identity.amazonaws.com', {
        StringEquals: {
          'cognito-identity.amazonaws.com:aud': this.authIdentityPool.ref
        }
      }, 'sts:AssumeRoleWithWebIdentity')
    });

    // Allow guests to search for stops and routes
    this.guestUsersRole.addToPolicy(new PolicyStatement({
      actions: ['execute-api:Invoke'],
      resources: [
        searchApi.arnForExecuteApi('GET', '/stops'),
        searchApi.arnForExecuteApi('GET', '/routes')
      ]
    }));

    // Attach guest role to identity pool
    new CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoleAttachments', {
      identityPoolId: this.authIdentityPool.ref,
      roles: {
        unauthenticated: this.guestUsersRole.roleArn
      }
    });

    this.websiteOriginAccessIdentity = new OriginAccessIdentity(this, 'WebUiOAI', {
      comment: 'Grants Cloudfront access to the website bucket'
    });

    // Initialize website bucket
    this.websiteBucket = new Bucket(this, 'WebsiteBucket', {
      removalPolicy: RemovalPolicy.DESTROY
    });

    // Configure the bucket policy
    this.websiteBucket.addToResourcePolicy(new PolicyStatement({
      principals: [new CanonicalUserPrincipal(this.websiteOriginAccessIdentity.cloudFrontOriginAccessIdentityS3CanonicalUserId)],
      actions: [
        's3:GetObject',
        's3:ListBucket'
      ],
      resources: [
        this.websiteBucket.bucketArn,
        this.websiteBucket.arnForObjects('*')
      ]
    }));

    this.websiteDistribution = new Distribution(this, 'WebsiteDistribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new S3Origin(this.websiteBucket, {
          originAccessIdentity: this.websiteOriginAccessIdentity
        }),
        cachePolicy: new CachePolicy(this, 'DefaultCachePolicy', {
          minTtl: Duration.seconds(0),
          defaultTtl: Duration.minutes(5),
          maxTtl: Duration.hours(24),
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      priceClass: PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/',
        }
      ],
    });

    // Output some values to use them elsewhere
    new CfnOutput(scope, 'AuthUnauthenticatedRoleArn', { value: this.guestUsersRole.roleArn });
    new CfnOutput(scope, 'AuthIdentityPoolId', { value: this.authIdentityPool.ref });
    new CfnOutput(scope, 'WebUiWebsiteBucketName', { value: this.websiteBucket.bucketName });
    new CfnOutput(scope, 'WebUiWebsiteUrl', { value: this.websiteDistribution.distributionDomainName });
  }
}
