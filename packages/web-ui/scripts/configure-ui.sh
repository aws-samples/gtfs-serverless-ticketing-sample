#!/bin/bash
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
project_dir="${script_dir}/.."

##########################################################################################################
#                                                                                                        #
# This script configures the web-ui component to communicate with the cloud services the project uses.   #
#                                                                                                        #
##########################################################################################################

echo "INFO: Configuring UI"

stack_name="GtfsTicketingSample"
stack_description=$(aws cloudformation describe-stacks --stack-name ${stack_name})

export aws_account_id=$(echo $stack_description | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "AwsAccountId") | .OutputValue')
export aws_region=$(echo $stack_description | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "AwsRegion") | .OutputValue')
export identity_pool_id=$(echo $stack_description | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "AuthIdentityPoolId") | .OutputValue')
export search_api_url=$(echo $stack_description | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "SearchApiUrl") | .OutputValue')

echo "INFO: Creating Typescript configuration"
config="module.exports = { \
  \"AWS_ACCOUNT_ID\": \"${aws_account_id}\", \
  \"AWS_REGION\": \"${aws_region}\", \
  \"IDENTITY_POOL_ID\": \"${identity_pool_id}\", \
  \"SEARCH_API_URL\": \"${search_api_url}\", \
}"

echo "INFO: Writing Typescript configuration"
echo $config > $project_dir/src/config.js
