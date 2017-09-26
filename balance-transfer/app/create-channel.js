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



function printMap(map)
{
	var str=""
  for(var item in map) {
	   var type=Object.prototype.toString.call(map[item]);
	  if(type=="[object Object]")
	  {
       str=str+item+":"+printMap(map[item])+",";
	  }
	  else
	  {
       str=str+item+":"+map[item]+",";
	  }  
  }  
 return str;
}


function setChannelConfig(client,channelName,channelConfigPath){
    var p = new Promise(function(resolve, reject){
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

//Attempt to send a request to the orderer with the sendCreateChain method
var createChannel = function(channelName, channelConfigPath, username, orgName,joinPeers,includeOrgs) {
	logger.debug('\n====== Creating Channel \'' + channelName + '\' ======\n');
	var client = helper.getClientForOrg(orgName);
	//var channel = helper.getChannelForOrg(orgName);  lmh  It's actually not use  20170914    

	//Acting as a client in the given organization provided with "orgName" param
	return helper.getOrgAdmin(orgName).then((admin) => {
		logger.debug(util.format('Successfully acquired admin user for the organization "%s"', orgName));
		// sign the channel config bytes as "endorsement", this is required by
		

	//add all org channel object into  helper.js's channels Object   |lmh 20170904
	 var orgs=helper.getOrgs();
    var channels=helper.getAllChannels();
    var channelOrg={};
	  for(let key in orgs)
	  {
          if (key.indexOf('org') === 0){
          	logger.debug("key:"+key);
          var org_client = helper.getClientForOrg(key);
          logger.debug('\n======BEGIN new Channel \'' + channelName + '\' ======\n');
          let channel = org_client.newChannel(channelName);
		  logger.debug('\n======END new  Channel \'' + channelName + '\' ======\n');
          channel.addOrderer(helper.newOrderer(org_client));
          channelOrg[key]=channel;
          }
	  }

     channels[channelName]=channelOrg;
	  logger.debug("************* channels[channelName][orgName]:"+channels[channelName]['org1']);
      helper.setChannels(channels);
      logger.debug("************* helper.getChannelForOrg(channelName,org):"+helper.getChannelForOrg(channelName,'org1'));
     //end
        //serialize the channels ,store into database
	    mysql.query("select * from channel where channelName='"+channelName+"'",function(err,results,fields){
            logger.debug("************* !!!!!!!!!!!!!!!!!!select * from channel where channelName,results.length:"+results.length);
			var createTime=new Date().Format("yyyy-MM-dd hh:mm:ss");
		   if(results.length >= 1){
                  logger.debug("************* results.length >= 1");
			  mysql.query("update channel  set joinPeers='"+joinPeers+"',includeOrgs='"+includeOrgs+"' where channelName='"+channelName+"'",function(err,results,fields){
			   //logger.debug(' err ::%j', err);
                            })
		   }
		   else
		   {
			   logger.debug("************* results.length < 1");
			 mysql.query("insert into channel (channelName,joinPeers,includeOrgs,createTime) VALUES('"+channelName+"','"+joinPeers+"','"+includeOrgs+"','"+createTime+"') ",function(err,results,fields){
			     // logger.debug(' err ::%j', err);
                             })                           
		   }
	   })
	  
     //end        
         // the orderer's channel creation policy
		  let tmp_response;
		return  setChannelConfig(client,channelName,channelConfigPath).then(
			 function (channelConfig,reject)
		   {
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

	}, (err) => {
		logger.error('Failed to enroll user \''+username+'\'. Error: ' + err);
		throw new Error('Failed to enroll user \''+username+'\'' + err);
	}).catch(function(reason_str){
        console.log('*****************rejected**************');
         console.log(reason_str);
		 var str=""+reason_str;
		  return str;
    });
};

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
