import React, { Component } from "react";
import Form from '@cloudscape-design/components/form';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Autosuggest from '@cloudscape-design/components/autosuggest';
import DatePicker from '@cloudscape-design/components/date-picker';
import Checkbox from '@cloudscape-design/components/checkbox';
import { SearchApi } from "../services/search-api.ts";

export interface SearchProps {
  Origin: string;
  Destination: string;
  OutboundDate: string;
  InboundDate?: string;
  WheelchairAvailability?: boolean;
  StationStatus?: string;
}

export class SearchForm extends Component {

  private readonly searchApi: SearchApi;
  private readonly successHandler: Function;

  public readonly state: SearchProps = {
    Origin: '',
    Destination: '',
    OutboundDate: '',
    StationStatus: 'finished'
  }

  public stations: any[] = [];

  constructor (props: any) {
    super(props);
    this.successHandler = props.onsubmit;
    this.stations = props.stations;
  }

  async setValue (prop: string, value: any) {
    this.setState({
      [prop]: value
    })
  }

  submitSearchRequest (event: any) {
    this.successHandler({ ...this.state });
    event.preventDefault();
  }

  render () {
    return (
      <form onSubmit={e => this.submitSearchRequest(e)}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link">
                Cancel
              </Button>
              <Button variant="primary">Submit</Button>
            </SpaceBetween>
          }
        >
          {/* Origin */}
          {
            parseInt(this.state.Origin) == this.state.Origin as any ? (
            <div>
              {/* An origin has been selected */}
              <b>From</b> {this.stations.find(s => s.stop_id === this.state.Origin)!.stop_name} ({this.stations.find(s => s.stop_id === this.state.Origin)!.stop_id})
              <Button variant="link" onClick={e => this.setValue('Origin', '')}>Clear</Button>

            </div>) : (
            <div>
              {/* No origin selected */}
              <FormField
                description="Choose where your transit should begin."
                label="From"
              >
                <Autosuggest
                  onChange={({ detail }) => this.setValue('Origin', detail.value)}
                  value={this.state.Origin}
                  options={this.stations.filter(station => station.stop_name.match(new RegExp(this.state.Origin), 'i')).map(station => ({ label: station.stop_name, value: station.stop_id }))}
                  enteredTextLabel={value => `Filter: "${value}"`}
                  placeholder="Filter stations"
                  empty={!this.state.Origin.length ? 'Start typing to filter stations' : 'No station found'}
                  statusType={this.state.StationStatus as any}
                />
              </FormField>   
            </div>)
          }

          {/* Destination */}
          {
            parseInt(this.state.Destination) == this.state.Destination as any ? (<div>
              {/* A destination has been selected */}
              <b>To</b> {this.stations.find(s => s.stop_id === this.state.Destination)!.stop_name} ({this.stations.find(s => s.stop_id === this.state.Destination)!.stop_id})
              <Button variant="link" onClick={e => this.setValue('Destination', '')}>Clear</Button>
            </div>) : (
              <div>
                <FormField
                  description="Choose where your transit should end."
                  label="To"
                >
                  <Autosuggest
                    onChange={({ detail }) => this.setValue('Destination', detail.value)}
                    value={this.state.Destination}
                    options={this.stations.filter(station => station.stop_name.match(new RegExp(this.state.Destination), 'i')).map(station => ({ label: station.stop_name, value: station.stop_id }))}
                    enteredTextLabel={value => `Filter: "${value}"`}
                    placeholder="Filter stations"
                    empty={!this.state.Destination.length ? 'Start typing to filter stations' : 'No station found'}
                    statusType={this.state.StationStatus as any}
                  />
                </FormField>
              </div>)
          }

          <SpaceBetween direction="horizontal" size="m">
            {/* Outbound date */}
            <FormField
              description="Choose the date for your outbound transit."
              label="Outbound date"
            >
              <DatePicker
                onChange={({ detail }) => this.setValue('OutboundDate', detail.value)}
                value={this.state.OutboundDate}
                openCalendarAriaLabel={selectedDate =>
                  "Choose Date" +
                  (selectedDate
                    ? `, selected date is ${selectedDate}`
                    : "")
                }
                nextMonthAriaLabel="Next month"
                placeholder="YYYY/MM/DD"
                previousMonthAriaLabel="Previous month"
                todayAriaLabel="Today"
              />
            </FormField>

            {/* Inbound date */}
            <FormField
              description="If you wish to search for return options, enter your date for the return transit."
              label="Inbound date"
            >
              <DatePicker
                onChange={({ detail }) => this.setValue('InboundDate', detail.value)}
                value={this.state.InboundDate || ''}
                openCalendarAriaLabel={selectedDate =>
                  "Choose Date" +
                  (selectedDate
                    ? `, selected date is ${selectedDate}`
                    : "")
                }
                nextMonthAriaLabel="Next month"
                placeholder="YYYY/MM/DD"
                previousMonthAriaLabel="Previous month"
                todayAriaLabel="Today"
              />
            </FormField>
          </SpaceBetween>

          {/* Wheelchair availability */}
          <FormField
            description="Configure your transit according to your needs."
            label="Other options"
          >
            <Checkbox
              onChange={({ detail }) =>
                this.setValue('WheelchairAvailability', detail.checked)
              }
              checked={!!this.state.WheelchairAvailability}
            >
              Wheelchair seating available
            </Checkbox>
          </FormField>
        </Form>
      </form>
    )
  }
}