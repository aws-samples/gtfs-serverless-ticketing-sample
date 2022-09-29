import * as config from '../config'
import { AuthService } from './auth.ts';
import apiFactory from 'aws-api-gateway-client';

export class SearchApi {
  private static instance?: SearchApi;

  private readonly apiUrl: string;
  
  private readonly credentials: any;
  private readonly apiClient: any;

  constructor (apiUrl: string) {
    this.apiUrl = apiUrl;

    const authService = AuthService.getInstance();
    const credentials = authService.getUnauthCredentials();
    this.credentials = credentials;
    this.apiClient = apiFactory.newClient({
      invokeUrl: this.apiUrl,
      region: config.AWS_REGION,
      accessKey: credentials.accessKeyId,
      secretKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken
    });
  }

  async searchStops (filter?: string): Promise<any[]> {
    const response = await this.apiClient.invokeApi({}, 'stops', 'GET', {  });
    return response.data;
  }

  async searchRoutes (origin: string, destination: string, outbound_date: string, inbound_date: string, wheelchair_seating: boolean): Promise<any[]> {
    const response = await this.apiClient.invokeApi({}, 'routes', 'GET', { 
      queryParams: { origin, destination, outbound_date, inbound_date, wheelchair_seating }
    });
    return response.data;
  }

  public static getInstance () {
    if (!this.instance) {
      const apiUrl = config.SEARCH_API_URL;
      this.instance = new SearchApi(apiUrl)
    };

    return this.instance
  }
}
