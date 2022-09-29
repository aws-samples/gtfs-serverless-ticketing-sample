#!/bin/bash
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
project_dir="${script_dir}/.."

echo "INFO: Configuring UI"
bash $script_dir/configure-ui.sh

echo "INFO: Preparing variables"
stack_name="GtfsTicketingSample"
stack_description=$(aws cloudformation describe-stacks --stack-name ${stack_name})
export website_bucket_name=$(echo $stack_description | jq -r '.Stacks[0].Outputs[] | select(.OutputKey == "WebUiWebsiteBucketName") | .OutputValue')

echo "INFO: Building source"
cd $project_dir
npm run build

echo "INFO: Copying assets"
cd $project_dir/build
aws s3 cp --recursive ./ s3://$website_bucket_name/
