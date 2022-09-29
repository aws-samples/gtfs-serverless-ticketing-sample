#!/bin/bash
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
project_dir="${script_dir}/.."

stack_name="GtfsTicketingSample"
stack_description=$(aws cloudformation describe-stacks --stack-name ${stack_name})
export website_url=$(echo $stack_description | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "WebUiWebsiteUrl") | .OutputValue')

echo "$website_url"