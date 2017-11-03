/**
 * Copyright 2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var util = require('util');
var fs = require('fs');
var path = require('path');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Create-Channel');
//mysql模块
var mysql = require('./mysqlUnit');
var exec = require('child_process').exec;

//Attempt to send a request to the orderer with the sendCreateChain method
var createChannel = function(channelName, channelConfigPath, username, orgName,joinPeers,includeOrgs) {
	logger.debug('\n====== Creating Channel \'' + channelName + '\' ======\n');
	var client = helper.getClientForOrg(orgName);  //后面三步都需要用到的变量，和传入的channelName等参数作为高阶作用域变量
    logger.debug("**************创建管道第一步，获取初始client对象，client:");
    logger.debug(client);

	//var channel = helper.getChannelForOrg(orgName);  lmh  It's actually not use  20170914

    //创建管道---第一步：调用shell脚本产生channel.tx
    function setChannelConfig(client,channelName,channelConfigPath){
        logger.debug('********创建管道--第一步:开始调用shell脚本产生channel.tx');
        var p = new Promise(function(resolve, reject){  //必须要写resolve和reject，这是固定的
            //add if channelConfigPath is null,then auto generate channel.tx
            var envelope;
            var channelConfig;
            if(channelConfigPath!=null && channelConfigPath!=""&& channelConfigPath != undefined)
            {
                logger.debug("*****************channelConfigPath!=null&& channelConfigPath!=''****************");
                // read in the envelope for the channel config raw bytes
                envelope = fs.readFileSync(path.join(__dirname, channelConfigPath));
                // extract the channel config bytes from the envelope to be signed
                channelConfig = client.extractChannelConfig(envelope);
                resolve(channelConfig);
            }else
            {
                // var cmd = "export FABRIC_CFG_PATH=$PWD/artifacts/channel";
                var cmd = "export FABRIC_CFG_PATH="+__dirname+"/../artifacts/channel;/usr/local/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./artifacts/channel/" + channelName + ".tx -channelID " + channelName;
                logger.debug('*******************************3333333  cmd:'+cmd);
                exec(cmd, function(err, stdout, stderr){
                    logger.debug('*******************************444  err:'+err+",stdout:"+stdout+",stderr:"+stderr);
                    if(!err) {
                        //成功创建tx文件。
                        logger.debug(util.format('Successfully generate  "%s".tx file ', channelName));
                        envelope = fs.readFileSync(path.join(__dirname, "../artifacts/channel/"+channelName+".tx"));
                        channelConfig = client.extractChannelConfig(envelope);
                        resolve(channelConfig);
                    }
                    else
                    {
                        reject("Failed to execute cmd!!!!");
                    }
                });
            }
        });
        return p;
     }

    //创建管道---第二步：构造request请求，调用fabric的nodejs sdk接口去创建管道
    function createChannelByChannelConfig(channelConfig){
        logger.debug('********创建管道--第二步:如果产生channel.tx成功，则构造request请求，调用fabric的nodejs sdk接口去创建管道');
        var p = new Promise(function(resolve, reject) {
            logger.debug('********channelConfig.length:' + channelConfig.length);
            // sign the channel config bytes as "endorsement", this is required by
            let signature = client.signChannelConfig(channelConfig);
            let request = {
                config: channelConfig,
                signatures: [signature],
                name: channelName,
                //orderer: channel.getOrderers()[0],   //origin code
                orderer: helper.newOrderer(client),   //edit by lmh  20170904
                txId: client.newTransactionID()
            };
            logger.debug('************ request:');
            logger.debug(request);
            // send to orderer
            return client.createChannel(request).then(function(response){   //有传递的作用域，必须要在then里重新用resolve和reject传递出相应的信息
                logger.debug("**************！！！创建管道第二步，获取client.createChannle后的client对象，client:");
                logger.debug(client);

                logger.debug('*******response:' );
                logger.debug(response );
                console.log('*******response:');
                console.log(response);
                if (response && response.status === 'SUCCESS') {
                    logger.debug('已经成功调用sdk接口创建管道,准备设置全局变量channels.');
                    resolve('createChannel \'' + channelName + ' is OK.');
                }else{
                    logger.error('\n创建管道 \'' + channelName + '\' 失败!\n\n');
                    let response = {
                        success: false,
                        message: 'Failed to createChannel \'' + channelName + '\' !'
                    };
                    reject(response);
                    throw new Error('Failed to create the channel \'' + channelName + '\'');
                }
              },function(err){
                logger.debug('*******创建管道失败，原因:' );
                logger.debug(err );
                logger.error('\n创建管道 \'' + channelName + '\' 失败!\n\n');
                reject(err);
              });
            });
        return p;
    }

    //创建管道---第三步：设置好全局变量channels,产生所有组织的channelOrg[orgName]对象
    function setGloboalChannelsObject(response){
        var p = new Promise(function(resolve, reject) {
            logger.debug('********创建管道--第三步:如果创建管道成功，则设置好全局变量channels,产生所有组织的channelOrg[orgName]对象');
                var orgs = helper.getOrgs();
                var channels = helper.getAllChannels();
                var channelOrg = {};
                for (let key in orgs) {
                    if (key.indexOf('org') === 0) {
                        logger.debug("key:" + key);
                        var org_client = helper.getClientForOrg(key);
                        logger.debug('\n======BEGIN new Channel \'' + channelName + '\' ======\n');
                        let channel = org_client.newChannel(channelName);
                        logger.debug('\n======END new  Channel \'' + channelName + '\' ======\n');
                        channel.addOrderer(helper.newOrderer(org_client));
                        channelOrg[key] = channel;
                    }
                }
                channels[channelName] = channelOrg;
                logger.debug("************* channels[channelName][orgName]:" + channels[channelName]['org1']);
                helper.setChannels(channels);
                logger.debug("************* helper.getChannelForOrg(channelName,org):" + helper.getChannelForOrg(channelName, 'org1'));
                logger.debug('设置全局变量channels成功.');

                let response = {
                    success: true,
                    message: 'Channel \'' + channelName + '\' created Successfully'
                };
                resolve(response);
               //return response;
        });
        return p;
    }
     //链式调用开始
    return helper.getOrgAdmin(orgName)
         .then(function(data){
            logger.debug(util.format('Successfully acquired admin user for the organization "%s"', orgName));
            return setChannelConfig(client,channelName,channelConfigPath);   //1.调用shell脚本产生channel.tx
          })
         .then(createChannelByChannelConfig)  //2.构造request请求，调用fabric的nodejs sdk接口去创建管道
         .then(setGloboalChannelsObject)   //3.设置好全局变量channels
        .then (function(response){         //4.返回最终respons给调用方
            logger.debug('*******Final response:' );
            logger.debug(response );

            logger.debug("**************成功创建管道后的channels对象，channels["+channelName+"]:");
            var channels = helper.getAllChannels();
            logger.debug(channels);
            logger.debug(channels['mychannel']);
            logger.debug(channels['mychannel']['org2']._peers);
            logger.debug(channels['mychannel']['org2']._orderers);
            logger.debug(channels['mychannel']['org2']._clientContext);
            logger.debug(channels['mychannel']['org2']._msp_manager);
            return response;
          })
         .catch(function(reason_str){
             logger.error('\n创建管道 \'' + channelName + '\' 失败!原因\n\n');
             logger.error(reason_str);
            console.log('***********创建管道失败，原因：');  //输出前端页面控制台
             console.log(reason_str);
            var str=""+reason_str;
            let response = {
            success: false,
            message: 'Channel \'' + channelName + '\' created faild!Reason:'+str
           };
            return response;
          });

    }

/*
    var p1=new Promise(function(data, reject) {
        //add all org channel object into  helper.js's channels Object   |lmh 20170904
        var orgs = helper.getOrgs();
        var channels = helper.getAllChannels();
        var channelOrg = {};
        for (let key in orgs) {
            if (key.indexOf('org') === 0) {
                logger.debug("key:" + key);
                var org_client = helper.getClientForOrg(key);
                logger.debug('\n======BEGIN new Channel \'' + channelName + '\' ======\n');
                let channel = org_client.newChannel(channelName);
                logger.debug('\n======END new  Channel \'' + channelName + '\' ======\n');
                channel.addOrderer(helper.newOrderer(org_client));
                channelOrg[key] = channel;
            }
        }

        channels[channelName] = channelOrg;
        logger.debug("************* channels[channelName][orgName]:" + channels[channelName]['org1']);
        helper.setChannels(channels);
        logger.debug("************* helper.getChannelForOrg(channelName,org):" + helper.getChannelForOrg(channelName, 'org1'));
    });

    var p2=new Promise(function(resolve, reject) {
        mysql.query("select * from channel where channelName='" + channelName + "'", function (err, results, fields) {
            logger.debug("************* !!!!!!!!!!!!!!!!!!select * from channel where channelName,results.length:" + results.length);
            var createTime = new Date().Format("yyyy-MM-dd hh:mm:ss");
            if (results.length >= 1) {
                logger.debug("************* results.length >= 1");
                mysql.query("update channel  set joinPeers='" + joinPeers + "',includeOrgs='" + includeOrgs + "' where channelName='" + channelName + "'", function (err, results, fields) {
                    //logger.debug(' err ::%j', err);
                    resolve("ok")
                })
            }
            else {
                logger.debug("************* results.length < 1");
                mysql.query("insert into channel (channelName,joinPeers,includeOrgs,createTime) VALUES('" + channelName + "','" + joinPeers + "','" + includeOrgs + "','" + createTime + "') ", function (err, results, fields) {
                    // logger.debug(' err ::%j', err);
                    resolve("ok")
                })
            }
        })
    });
       p1.then( function (resolve,reject){
            return p2.then(function (resolve,reject){
                return  setChannelConfig(client,channelName,channelConfigPath).then(
                    function (channelConfig,reject){
                        logger.debug('*******************************555 channelConfig.length:'+channelConfig.length);
                        let signature = client.signChannelConfig(channelConfig);

                        let request = {
                            config: channelConfig,
                            signatures: [signature],
                            name: channelName,
                            //orderer: channel.getOrderers()[0],   //origin code
                            orderer:  helper.newOrderer(client)  ,   //edit by lmh  20170904
                            txId: client.newTransactionID()
                        };
                        logger.debug('*******************************555 request:');
                        logger.debug(request);
                        // send to orderer
                        return client.createChannel(request).then((response) => {
                                logger.debug(' response ::%j', response);
                        console.log(' response ::%j', response);
                        if (response && response.status === 'SUCCESS') {
                            logger.debug('Successfully created the channel.');
                            let response = {
                                success: true,
                                message: 'Channel \'' + channelName + '\' created Successfully'
                            };
                            return response;
                        } else {
                            logger.error('\n!!!!!!!!! Failed to create the channel \'' + channelName +
                                '\' !!!!!!!!!\n\n');
                            throw new Error('Failed to create the channel \'' + channelName + '\'');
                        }
                      }, (err) => {
                        logger.error('Failed to initialize the channel: ' + err.stack ? err.stack :
                            err);
                        throw new Error('Failed to initialize the channel: ' + err.stack ? err.stack : err);
                       });
                    });
            }).catch(function(reason_str){
                console.log('*****************rejected**************');
                console.log(reason_str);
                var str=""+reason_str;
                let response = {
                    success: false,
                    message: 'Channel \'' + channelName + '\' created faild!Reason:'+str
                };
                return response;
            });;
	       });
	    })
};
*/
// 对Date的扩展，将 Date 转化为指定格式的String
// 月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符， 
// 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) 
// 例子： 
// (new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423 
// (new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18 
Date.prototype.Format = function (fmt) { //author: meizz 
    var o = {
        "M+": this.getMonth() + 1, //月份 
        "d+": this.getDate(), //日 
        "h+": this.getHours(), //小时 
        "m+": this.getMinutes(), //分 
        "s+": this.getSeconds(), //秒 
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度 
        "S": this.getMilliseconds() //毫秒 
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}
exports.createChannel = createChannel;
