#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#


#export FABRIC_CFG_PATH=/opt/fabric-1.0/app-network/new_artifacts/channel
#/usr/local/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./new_artifacts/channel.tx -channelID mychannel

sleep 3

jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
	echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
	echo
	exit 1
fi
starttime=$(date +%s)

echo "POST request Enroll on aaa  ..."
echo
ORG1_TOKEN=$(curl -s -X POST \
  http://172.17.21.190:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Jimaa&orgName=org1')
echo $ORG1_TOKEN
ORG1_TOKEN=$(echo $ORG1_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG1 token is $ORG1_TOKEN"
echo

echo







echo "Total execution time : $(($(date +%s)-starttime)) secs ..."
