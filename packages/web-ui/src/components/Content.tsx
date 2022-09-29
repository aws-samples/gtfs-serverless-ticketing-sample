import React, { Component } from "react";
import moment from 'moment';
import ContentLayout from "@cloudscape-design/components/content-layout";
import SpaceBetween from '@cloudscape-design/components/space-between';
import Header from '@cloudscape-design/components/header';
import Alert from '@cloudscape-design/components/alert';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Link from '@cloudscape-design/components/link';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';

import './Content.scss';
import { SearchForm } from './Search.tsx';
import { SearchApi } from "../services/search-api.ts";

export interface ContentState {
  UIState: 'search' | 'loading' | 'results';
  Stops?: any[];
  Routes?: any[];
  Origin?: string;
  Destination?: string;
  OutboundDate?: string;
  InboundDate?: string;
  WheelchairAvailability?: boolean;
}

export class Content extends Component {

  private readonly searchApi: SearchApi;

  public state: ContentState = {
    UIState: 'search',
  };

  constructor (props: any) {
    super(props);

    this.searchApi = SearchApi.getInstance();
    this.searchApi.searchStops()
      .then(data => {
        this.setState({ Stops: data });
      });
  }

  resetView () {
    this.setState({ UIState: 'search', Routes: [] });
  }

  async searchRoutes (data: any) {
    this.setState({ UIState: 'loading', ...data });
    const Routes = await this.searchApi.searchRoutes(data.Origin, data.Destination, data.OutboundDate, data.InboundDate, data.WheelchairAvailability);
    if (!(Routes instanceof Array)) {
      console.error('ERROR: Failed retrieving data');
      this.setState({ UIState: 'results', Routes: [] });
    } else {
      debugger
      this.setState({ UIState: 'results', Routes });
    }
  }

  render () {
    return (
      <ContentLayout
        header={
          <SpaceBetween size="m">
            <Header
              variant="h1"
              info={<Link>GitHub</Link>}
              description="Sample Serverless transit search and ticketing system using GTFS public data"
            >
              GTFS Ticketing Sample
            </Header>
  
            <Alert>This is not productive software, and it only represents a <i>happy-path</i> sample of creating fully Serverless, scalable systems for searching through complex data. This project shall never be used in production <i>as-is</i>, and there is no warranty, support or liability for its usage. If in doubt, please contact your AWS account team.</Alert>
          </SpaceBetween>
        }
      >   
          {
            !this.state.Stops ? <Container>Loading data</Container>:
            this.state.UIState === 'search' ? 
              (
                <Container
                  header={
                    <Header
                      variant="h2"
                      description="Fill-in the details to find a suitable transit"
                    >
                      Find a transit
                    </Header>
                  }
                >
                  <SearchForm 
                    stations={this.state.Stops!}
                    onsubmit={e => this.searchRoutes(e)} />
                </Container>
              )
            : (<Table
              header={<Header
                description={`From ${this.state.Stops.find(s => s.stop_id === this.state.Origin).stop_name} to ${this.state.Stops.find(s => s.stop_id === this.state.Destination).stop_name}, on ${moment(this.state.OutboundDate).format('MMM Do, YYYY')}`}
                actions={
                  <Button variant="primary" onClick={e => this.resetView()}>New search</Button>
                }>Your transit results</Header>}
              columnDefinitions={[
                {
                  id: "departure",
                  header: "Departure",
                  cell: e => e.Itinerary.find(i => i.stop_id === this.state.Origin!)!.departure_time,
                },
                {
                  id: "arrival",
                  header: "Arrival",
                  cell: e => e.Itinerary.find(i => i.stop_id === this.state.Destination!)!.arrival_time,
                },
                {
                  id: "route_name",
                  header: "Route name",
                  cell: e => e.Route.route_short_name,
                },
                {
                  id: "service",
                  header: "Service",
                  cell: e => {
                    const date = moment(this.state.OutboundDate);
                    const weekday = date.format('dddd').toLowerCase();
                    return e.Calendar[weekday] === '1' ? (<Box color="text-status-success">In Service</Box>) : (<Box color="text-status-error">No Service</Box>)
                  }
                },
                {
                  id: "itinerary",
                  header: "Itinerary",
                  cell: e => e.Itinerary
                    .sort((a: any, b: any) => (parseInt(a.stop_sequence) - parseInt(b.stop_sequence)))
                    .map(stop => {
                      return ([this.state.Origin, this.state.Destination].indexOf(stop.stop_id) !== -1 ? (<b className="itinerary-step">{this.state.Stops!.find(s => s.stop_id === stop.stop_id)!.stop_name}</b>) : (<span className="itinerary-step">{this.state.Stops!.find(s => s.stop_id === stop.stop_id)!.stop_name}</span>));
                    })
                },
                {
                  id: "service_from",
                  header: "Service start",
                  cell: e => `${moment(e.Calendar.start_date, 'YYYYMMDD').fromNow()}`
                },
                {
                  id: "service_to",
                  header: "Service end",
                  cell: e => `${moment(e.Calendar.end_date, 'YYYYMMDD').fromNow()}`
                },
                {
                  id: "service_days",
                  header: "Service days",
                  cell: e => [
                    e.Calendar.monday ? 'Monday' : null,
                    e.Calendar.tuesday ? 'Tuesday' : null,
                    e.Calendar.wednesday ? 'Wednesday' : null,
                    e.Calendar.thursday ? 'Thursday' : null,
                    e.Calendar.friday ? 'Friday' : null,
                    e.Calendar.saturday ? 'Saturday' : null,
                    e.Calendar.sunday ? 'Sunday' : null,
                  ].filter(e => !!e).join(', ')
                },
              ]}
              items={(this.state.Routes || []).sort((a: any, b: any) => (parseInt(a.Itinerary.find(i => i.stop_id === this.state.Origin!)!.departure_time.split(':').join('')) - parseInt(b.Itinerary.find(i => i.stop_id === this.state.Origin!)!.departure_time.split(':').join(''))))}
              loading={this.state.UIState === 'loading'}
              loadingText="Loading transits"
              empty={
                <Box textAlign="center" color="inherit">
                  <b>No transit available</b>
                </Box>
              }
              
            />)
          }
      </ContentLayout>
    );
  }
}