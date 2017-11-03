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
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('install-chaincode');
var tx_id = null;
//function installChaincode(org) {
var installChaincode = function(peers, chaincodeName, chaincodePath,
	chaincodeVersion, username, org) {
	logger.debug(
		'\n============ Install chaincode on organizations ============\n');
	helper.setupChaincodeDeploy();//设置gopath目录
	//var channel = helper.getChannelForOrg(org);  edit by lmh ,content: uncomment this line,Because it doesn't work
	var client = helper.getClientForOrg(org);

	return helper.getOrgAdmin(org).then((user) => {
		var request = {
			targets: helper.newPeers(peers, org),
			chaincodePath: chaincodePath,
			chaincodeId: chaincodeName,
			chaincodeVersion: chaincodeVersion
		};
		return client.installChaincode(request);
	}, (err) => {
		logger.error('Failed to enroll user \'' + username + '\'. ' + err);
		throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
	}).then((results) => {
        logger.debug('****************install-chaincode result:');
        logger.debug(results);
		var proposalResponses = results[0];
		var proposal = results[1];
		var all_good = true;
		//要记录下所有错误的proposalResponses
	    var arr_response={};
		for (var i in proposalResponses) {
			let one_good = false;
			if (proposalResponses && proposalResponses[i].response && proposalResponses[i].response.status === 200) {
                logger.debug("**********proposalResponses["+i+"].response:");
                logger.debug(proposalResponses[i].response);
				one_good = true;
                var tmp_rep=proposalResponses[i].response;
                tmp_rep.peerId=peers[i];
                arr_response[i]=tmp_rep;
				logger.info('install proposal was good');
			} else {
                logger.debug("**********proposalResponses["+i+"].message:");
                logger.debug(proposalResponses[i].message);
                var tmp_rep={};
                tmp_rep.status=500;
                tmp_rep.message=org+"."+peers[i]+"安装失败!原因:\n"+proposalResponses[i].message;
                tmp_rep.peerId=peers[i];
                arr_response[i]=tmp_rep;
				logger.error('install proposal was bad');
			}
			all_good = all_good & one_good;
		}
		if (all_good) {
			logger.info(util.format('Successfully sent install Proposal and received ProposalResponse: Status - %s',
				proposalResponses[0].response.status));
			logger.debug('\nSuccessfully Installed chaincode on organization ' + org + '\n');
            let response = {
                success: true,
                message: 'Successfully Installed chaincode '+chaincodeName+' on '+peers+' of organization '+ org+'!',
				data: arr_response
            };
            logger.debug('**********final response:');
            logger.debug(response);
			return response
		} else {
			logger.error(
				'Failed to send install Proposal or receive valid response. Response null or status is not 200. exiting...'
			);
            let response = {
                success: false,
                message: 'Failed to  Installed chaincode '+chaincodeName+' on '+peers+' of organization '+ org+'!',
				data: arr_response
              };
            logger.debug('**********final response:');
            logger.debug(response);
			return response;
		}
	}, (err) => {
		logger.error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
        let response = {
            success: false,
            message: 'Failed to  Installed chaincode '+chaincodeName+' on '+peers+' of organization '+ org+'!Reason:'+err
        };
        logger.debug('**********final response:');
        logger.debug(response);
        return response;
		//throw new Error('Failed to send install proposal due to error: ' + err.stack ? err.stack : err);
	}).catch(function(reason_str){
        logger.error('\n安装智能合约 \'' + chaincodeName + '\'在组织'+org+'的'+peers +'失败!原因:\n\n');
        logger.error(reason_str);
        console.log('\n安装智能合约 \'' + chaincodeName + '\'在组织'+org+'的'+peers +'失败!原因:\n\n'); //输出前端页面控制台
        console.log(reason_str);
        var str=""+reason_str;
        let response = {
            success: false,
            message: 'Failed to  Installed chaincode '+chaincodeName+' on '+peers+' of organization '+ org+'!Reason:'+reason_str,
            data: arr_response
        };
        return response;
    });
};
exports.installChaincode = installChaincode;
