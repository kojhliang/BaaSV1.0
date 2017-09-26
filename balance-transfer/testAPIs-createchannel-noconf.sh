#!/bin/bash
#
# Copyright IBM Corp. All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
#
channelname=$1;
#export FABRIC_CFG_PATH=$PWD/artifacts/channel
#configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./artifacts/channel/$channelname.tx -channelID $channelname

jq --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
	echo "Please Install 'jq' https://stedolan.github.io/jq/ to execute this script"
	echo
	exit 1
fi
starttime=$(date +%s)

echo "POST request Enroll on Org1  ..."
echo
ORG1_TOKEN=$(curl -s -X POST \
  http://localhost:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Jim&orgName=org1')
echo $ORG1_TOKEN
ORG1_TOKEN=$(echo $ORG1_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG1 token is $ORG1_TOKEN"
echo
echo "POST request Enroll on Org2 ..."
echo
ORG2_TOKEN=$(curl -s -X POST \
  http://localhost:4000/users \
  -H "content-type: application/x-www-form-urlencoded" \
  -d 'username=Barry&orgName=org2')
echo $ORG2_TOKEN
ORG2_TOKEN=$(echo $ORG2_TOKEN | jq ".token" | sed "s/\"//g")
echo
echo "ORG2 token is $ORG2_TOKEN"
echo
echo
echo "POST request Create channel  ..."
echo
#curl -s -X POST \
#  http://localhost:4000/channels \
#  -H "authorization: Bearer $ORG1_TOKEN" \
#  -H "content-type: application/json" \
#  -d "{
#	\"channelName\":\"$channelname\",
#	\"channelConfigPath\":\"../artifacts/channel/$channelname.tx\"
#        \"joinPeers\":\"org1.peer1,org1.peer2;org2.peer1,org2.peer2\",
#	\"includeOrgs\":\"org1,org2\"
#}"
curl -s -X POST \
  http://localhost:5000/channels \
  -H "authorization: Bearer $ORG1_TOKEN" \
  -H "content-type: application/json" \
  -d "{
        \"channelName\":\"$channelname\",
        \"joinPeers\":\"org1.peer1,org1.peer2;org2.peer1,org2.peer2\",
        \"includeOrgs\":\"org1,org2\"
}"
echo
echo
