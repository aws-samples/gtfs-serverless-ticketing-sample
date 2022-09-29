
import aws, { Credentials } from "aws-sdk/global";
import { CognitoIdentity } from "aws-sdk";
import * as config from '../config';

export class AuthService {
  private static instance?: AuthService;

  public readonly idPoolId: string;
  private readonly cognito: CognitoIdentity;
  private readonly awsRegion: string;
  public readonly awsAccountId: string;

  private unauthCredentials?: Credentials;

  public user?: string;
  public username?: string;
  public groups?: string[];
  public role?: string;
  public UserId?: string;
  public accessToken?: any;

  private readonly responseType: string = 'token';

  constructor(identityPoolId: string, awsRegion: string, awsAccountId: string) {

    this.idPoolId = identityPoolId;
    const region = awsRegion;
    this.cognito = new CognitoIdentity({
      region
    });
    this.awsAccountId = awsAccountId;

    // Load existing credentials
    this.getUnauthCredentials();
  }

  storeTokenInformation(token: any): void {
    this.user = token.preferred_username || token["cognito:username"];
    this.username = token["cognito:username"];
    this.groups = token["cognito:groups"];
    this.role = token["cognito:preferred_role"];
    this.UserId = token.sub;
    this.accessToken = token;

    // console.debug("token", token);
    localStorage.setItem("auth-access-token", JSON.stringify(token));
  }

  getUnauthCredentials(): Credentials | undefined {
    if (!this.unauthCredentials) {
      const retrievedCredentialsStr = localStorage.getItem(
        "unauth-credentials"
      );
      if (!retrievedCredentialsStr) {
        return undefined;
      }

      const retrievedCredentials = JSON.parse(retrievedCredentialsStr);
      if (!this.verifyCredentials(retrievedCredentials)) {
        return undefined;
      }
      this.unauthCredentials = aws.config.credentials = retrievedCredentials;
    }

    return this.unauthCredentials;
  }

  getIdentity(): string | null {
    const identity = localStorage.getItem("auth-identity");
    return identity;
  }

  getUnauthIdentity(): string | null {
    const identity = localStorage.getItem("unauth-identity");
    return identity;
  }

  async unauthLogin(): Promise<Credentials> {
    const AccountId = this.awsAccountId;
    const request = {
      IdentityPoolId: this.idPoolId,
      AccountId
    };

    const ret = await this.getCognitoId(request);
    return ret;
  }

  async getCognitoId(
    request: CognitoIdentity.GetIdInput
  ): Promise<Credentials> {
    const { Logins } = request;

    const cognitoId = await this.cognito.getId(request).promise();

    console.log("INFO: Successfully authenticated.");
    const { IdentityId } = cognitoId;

    return this.finalizeLogin(IdentityId!, Logins);
  }

  async finalizeLogin(
    IdentityId: string,
    Logins?: { [key: string]: string }
  ): Promise<Credentials> {
    const cognitoCredentials = await this.cognito
      .getCredentialsForIdentity({
        IdentityId,
        Logins
      })
      .promise();

    const creds = cognitoCredentials.Credentials;

    console.log("INFO: Successfully fetched credentials.");
    const credentials = {
      accessKeyId: creds!.AccessKeyId!,
      secretAccessKey: creds!.SecretKey!,
      sessionToken: creds!.SessionToken!,
      expireTime: creds!.Expiration!
    };

    let retCredentials: Credentials;
    this.unauthCredentials = new Credentials(credentials);
    retCredentials = this.unauthCredentials;
    localStorage.setItem("unauth-credentials", JSON.stringify(credentials));
    localStorage.setItem("unauth-identity", IdentityId);

    aws.config.credentials = credentials;

    return retCredentials;
  }

  verifyCredentials(creds: Credentials): boolean {
    const expiration = new Date(creds.expireTime!).getTime();
    const now = new Date().getTime();

    return now < expiration;
  }

  static getInstance() {
    if (!AuthService.instance) {
      const identityPoolId = config.IDENTITY_POOL_ID;
      const awsRegion = config.AWS_REGION;
      const awsAccountId = config.AWS_ACCOUNT_ID;

      AuthService.instance = new AuthService(
        identityPoolId,
        awsRegion,
        awsAccountId
      );
    }
    return AuthService.instance;
  }
}
