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
var logger = helper.getLogger('instantiate-chaincode');
var ORGS = hfc.getConfigSetting('network-config');
var tx_id = null;
var eh = null;
var deployId=null;
//原版写死peer1，因为例子里是一定把peer1作为锚点，所以写死。但BaaS平台不应写死peer1，有可能是peerN的，如果不改，就会引发监听不到事件的情况发生，导致最后无法返回正确结果。
var instantiateChaincode = function(channelName, chaincodeName, chaincodeVersion, functionName, args, username, org,peerId) {
	logger.debug('\n============ Instantiate chaincode on organization ' + org + ',peerId:'+peerId+
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
			txId: tx_id,
            endorsement:generateEndorsePolicyObject()
		};
       logger.info('**** instantiateChaincode request:');
       logger.info(request);
		if (functionName)
			request.fcn = functionName;

		return channel.sendInstantiateProposal(request,300000);  //初始化需要的时间比较久，把timeout时间设成300秒 lmh
	}, (err) => {
		logger.error('Failed to initialize the channel');
		throw new Error('Failed to initialize the channel');
	}).then((results) => {
		var proposalResponses = results[0];
        logger.info('**********proposalResponses:');
       logger.info(proposalResponses);
		var proposal = results[1];
      logger.info('**********proposal:');
      logger.info(proposal);
		var all_good = true;
		var err_msg={};
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response &&
				proposalResponses[i].response.status === 200) {
				one_good = true;
				logger.info('instantiate proposal was good');
			} else {
                // logger.error('instantiate proposal was bad，msg:'+proposalResponses[i].response.message);
                // err_msg[i]=proposalResponses[i].response.message;
                logger.error('instantiate proposal was bad，msg:'+proposalResponses[i].message);
                err_msg[i]=proposalResponses[i].message;
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			// logger.info(util.format(
			// 	'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
			// 	proposalResponses[0].response.status, proposalResponses[0].response.message,
			// 	proposalResponses[0].response.payload, proposalResponses[0].endorsement
			// 	.signature));
            logger.debug('Successfully sent Proposal and received ProposalResponse');
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal
			};
            //logger.info('*************request:');
           // logger.info(request);
			// set the transaction listener and set a timeout of 30sec
			// if the transaction did not get committed within the timeout period,
			// fail the test
			var deployId = tx_id.getTransactionID();
            logger.info('*************deployId:'+deployId);

			eh = client.newEventHub();
			// let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers['peer1'][ //这个会引发问题，因为如果不是在peer1上加入了管道并安装了智能合约，这个事件监听请求是无法收到的
			// 	'tls_cacerts'
			// ]));
            let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers[peerId][
                'tls_cacerts'
                ]));
            //logger.info('*************data:');
            //logger.info(data);
            // eh.setPeerAddr(ORGS[org].peers['peer1']['events'], {   //这个会引发问题，因为如果不是在peer1上加入了管道并安装了智能合约，这个事件监听请求是无法收到的
				// pem: Buffer.from(data).toString(),
				// 'ssl-target-name-override': ORGS[org].peers['peer1']['server-hostname']
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
						'The chaincode instantiate transaction has been committed on peer ' +
						eh._ep._endpoint.addr);
					clearTimeout(handle);
					eh.unregisterTxEvent(deployId);
					eh.disconnect();

					if (code !== 'VALID') {
						logger.error('The chaincode instantiate transaction was invalid, code = ' + code);
						reject();
					} else {
						logger.info('The chaincode instantiate transaction was valid.');
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
				logger.error('Failed to send instantiate transaction and get notifications within the timeout period. '+deployId);
               let res = {
                success: false,
                message: '连接超时,请尝试再重新初始化一次',
                data: deployId
                };
                return res;
			});
		} else {
			 var str=JSON.stringify(err_msg);
			logger.error(
				'初始化合约出错！错误信息：'+str
			);
            let res = {
                success: false,
                message:  '初始化合约出错！错误信息：'+str,
                data: deployId
            };
            return res;
		}
	}, (err) => {
		logger.error('Failed to send instantiate proposal due to error: ' + err.stack ?
			err.stack : err);
        let res = {
            success: false,
            message:  'Failed to send instantiate proposal due to error: ' + err,
            data: deployId
        };
        return res;
	}).catch(function(reason_str){
        logger.error('\n初始化智能合约 \'' + chaincodeName + '\'失败!原因:\n\n');
        logger.error(reason_str);
        console.log('\n安装智能合约 \'' + chaincodeName + '\'失败!原因:\n\n'); //输出前端页面控制台
        console.log(reason_str);
        var str=""+reason_str;
        let response = {
            success: false,
            message: 'Failed to  Installed chaincode '+chaincodeName+'!Reason:'+reason_str,
            data: deployId
        };
        return response;
    });

	/*
	.then((response) => {
		if (response.status === 'SUCCESS') {
			logger.info('Successfully sent transaction to the orderer.');
            let res = {
            success: true,
            message: 'Instantiate Chaincode '+chaincodeName+":"+chaincodeVersion+'is success!',
            data: deployId
             };
			return res;
		} else {
			logger.error('Failed to order the transaction. Error code: ' + response.status);
            let res = {
            success: false,
            message: 'Failed to order the transaction. Error code: ' + response.status,
            data: deployId
            };
			return res;
		}
	}, (err) => {
		logger.error('Failed to send instantiate due to error: ' + err.stack ? err
			.stack : err);
        let res = {
            success: false,
            message:  'Failed to send instantiate due to error: ' + err,
            data: deployId
        };
		return res;
	});*/
};
exports.instantiateChaincode = instantiateChaincode;

//产生fabric-nodejs-sdk发送初始化或者升级智能合约时，需要的背书策略对象
//为了方便，默认是策略是任意一个组织进行签名即可
function generateEndorsePolicyObject(){
	var policyObject={};
    var identities= new Array();
    var signOrgs= new Array();
    var count=0;
    for (let org in ORGS) {
        if (org.indexOf('org') === 0) {

            var msp=ORGS[org].mspid;
            var identy={"role":{"name":org,"mspId":msp}};
            identities.push(identy);

            var signOrg={ "signed-by": count };
            signOrgs.push(signOrg);
            count++;
        }
    }
    policyObject={"identities":identities,"policy":{"1-of":signOrgs}};
      return policyObject;
}
