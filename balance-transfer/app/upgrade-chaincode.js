/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var helper = require('./helper.js');
var logger = helper.getLogger('upgrade-chaincode');
var ORGS = hfc.getConfigSetting('network-config');
var tx_id = null;
var eh = null;

var upgradeChaincode = function(channelName, chaincodeName, chaincodeVersion, functionName, args, username, org,peerId) {
	logger.debug('\n============ Upgrade chaincode on organization ' + org +
		' ============\n');

	var channel = helper.getChannelForOrg(channelName,org);//edit by lmh 20170904,content:add channelName param
	var client = helper.getClientForOrg(org);

	return helper.getOrgAdmin(org).then((user) => {
		// read the config block from the orderer for the channel
		// and initialize the verify MSPs based on the participating
		// organizations
		return channel.initialize();
	}, (err) => {
		logger.error('Failed to enroll user \'' + username + '\'. ' + err);
		throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
	}).then((success) => {
		tx_id = client.newTransactionID();
		// send proposal to endorser
		var request = {
			chaincodeId: chaincodeName,
			chaincodeVersion: chaincodeVersion,
			args: args,
			txId: tx_id
		};

		if (functionName)
			request.fcn = functionName;

		return channel.sendUpgradeProposal(request,300000);
	}, (err) => {
		logger.error('Failed to initialize the channel');
		throw new Error('Failed to initialize the channel');
	}).then((results) => {
		var proposalResponses = results[0];
		var proposal = results[1];
		var all_good = true;
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response &&
				proposalResponses[i].response.status === 200) {
				one_good = true;
				logger.info('instantiate proposal was good');
			} else {
				logger.error('instantiate proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			logger.info(util.format(
				'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
				proposalResponses[0].response.status, proposalResponses[0].response.message,
				proposalResponses[0].response.payload, proposalResponses[0].endorsement
				.signature));
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};
            logger.info('*************request:');
            logger.info(request);
			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var deployId = tx_id.getTransactionID();
            logger.info('*************deployId:'+deployId);

			eh = client.newEventHub();
			// let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers['peer1'][  //这个会引发问题，因为如果不是在peer1上加入了管道并安装了智能合约，这个事件监听请求是无法收到的
			// 	'tls_cacerts'
			// ]));
            let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers[peerId][
                'tls_cacerts'
                ]));
            logger.info('*************data:');
            logger.info(data);
			// eh.setPeerAddr(ORGS[org].peers['peer1']['events'], { //这个会引发问题，因为如果不是在peer1上加入了管道并安装了智能合约，这个事件监听请求是无法收到的
			// 	pem: Buffer.from(data).toString(),
			// 	'ssl-target-name-override': ORGS[org].peers['peer1']['server-hostname']
			// });
            eh.setPeerAddr(ORGS[org].peers[peerId]['events'], {
                pem: Buffer.from(data).toString(),
                'ssl-target-name-override': ORGS[org].peers[peerId]['server-hostname']
            });
			eh.connect();

			let txPromise = new Promise((resolve, reject) => {
				let handle = setTimeout(() => {
					eh.disconnect();
					reject();
				}, 5000);

				eh.registerTxEvent(deployId, (tx, code) => {
					logger.info(
						'The chaincode upgrade transaction has been committed on peer ' +
						eh._ep._endpoint.addr);
					clearTimeout(handle);
					eh.unregisterTxEvent(deployId);
					eh.disconnect();

					if (code !== 'VALID') {
						logger.error('The chaincode upgrade transaction was invalid, code = ' + code);
						reject();
					} else {
						logger.info('The chaincode upgrade transaction was valid.');
						resolve();
					}
				});
			});

			var sendPromise = channel.sendTransaction(request);
            logger.info('*************sendPromise:');
            logger.info(sendPromise);
			return Promise.all([sendPromise].concat([txPromise])).then((results) => {
				logger.debug('Event promise all complete and testing complete');
				return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
			}).catch((err) => {
				logger.error(
					util.format('Failed to send upgrade transaction and get notifications within the timeout period. %s', err)
				);
               let res = {
                success: false,
                message:  'Failed to send upgrade transaction and get notifications within the timeout period.',
                data: deployId
            };
				//return 'Failed to send upgrade transaction and get notifications within the timeout period.';
			return res;
			});
		} else {
			logger.error(
				'Failed to send upgrade Proposal or receive valid response. Response null or status is not 200. exiting...'
			);
            let res = {
                success: false,
                message:  'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...',
                data: deployId
            };
			return res;
		}
	}, (err) => {
		logger.error('Failed to send upgrade proposal due to error: ' + err.stack ?
			err.stack : err);
        let res = {
            success: false,
            message:  'Failed to send upgrade proposal due to error: ' + err,
            data: deployId
        };
        return res;
	}).catch(function(reason_str){
        logger.error('\n升级智能合约 \'' + chaincodeName + '\'失败!原因:\n\n');
        logger.error(reason_str);
        console.log('\n升级智能合约 \'' + chaincodeName + '\'失败!原因:\n\n'); //输出前端页面控制台
        console.log(reason_str);
        var str=""+reason_str;
        let response = {
            success: false,
            message: 'Failed to  Upgrade chaincode '+chaincodeName+'!Reason:'+reason_str,
            data: deployId
        };
        return response;
    });


	/*
	.then((response) => {
		if (response.status === 'SUCCESS') {
			logger.info('Successfully sent transaction to the orderer.');
			return 'Chaincode Upgrade is SUCCESS';
		} else {
			logger.error('Failed to order the transaction. Error code: ' + response.status);
			return 'Failed to order the transaction. Error code: ' + response.status;
		}
	}, (err) => {
		logger.error('Failed to send upgrade due to error: ' + err.stack ? err
			.stack : err);
		return 'Failed to send upgrade due to error: ' + err.stack ? err.stack :
			err;
	});*/
};
exports.upgradeChaincode = upgradeChaincode;
