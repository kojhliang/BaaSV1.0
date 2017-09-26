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
'use strict';
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('DEBUG');

var path = require('path');
var util = require('util');
var fs = require('fs-extra');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');
var copService = require('fabric-ca-client');

var hfc = require('fabric-client');
hfc.setLogger(logger);
var ORGS = hfc.getConfigSetting('network-config');

//mysql模块
var mysql = require('./mysqlUnit');
var Docker = require('dockerode');

var clients = {};
var channels = {};
var caClients = {};


for (let org in ORGS) {
    if (org.indexOf('org') === 0) {
        for (let peer in ORGS[org].peers) {
            if (peer.indexOf('peer') === 0) {
                var peerIP = ORGS[org].peers[peer]['requests'];
                var peerName = peer;
                var orgName = org;
                var dockerName = ORGS[org].peers[peer]['server-hostname'];
                console.log("peerIP = "+peerIP);
                console.log("peerName ="+peerName);
                console.log("orgName ="+orgName);
                console.log("dockerName ="+dockerName);
                var ip =peerIP.toString().split(":")[1].split("//")[1];
                console.log("ip ="+ip);
                addVpNodeToDatabase(ip,dockerName,orgName);
            }
        }
    }
}

//保存容器id到数据库
function addVpNodeToDatabase(ip,name,orgName) {
    //
    var docker = new Docker({host: 'http://'+ip, port: 2375});
    if(docker ==null){
        console.log("docker is null "+ip);
        return;
    }
    docker.listContainers(function (err, containers) {
        containers.forEach(function (containerInfo) {
            console.log("Names = "+containerInfo.Names[0]);

            if(containerInfo.Names[0].replace("_","").replace("/","") == name){
                mysql.query("select * from org where orgName=?",[orgName],function(err,results,fields){
                    //如果组织没有在数据库，则增加
                    if(results.length ==0){
                        var data = {orgName:orgName};
                        mysql.query("insert into org set ?",data,function(err,results,fields){
                            var orgId=results.insertId;
                            insertOrUpdatePeer(ip,name,orgId);
                        });
                    }else {
                        var orgId=results[0].pk_Id;
                        insertOrUpdatePeer(ip,name,orgId,containerInfo);
                    }

                });
            }
        });
    });
}

function insertOrUpdatePeer(ip,name,orgId,containerInfo) {
    mysql.query("select * from peernode where PeerName=?",[name],function(err,results,fields){

        //如果vpNode名称不在数据库，增加
        if(results.length ==0){
            var data = {PeerName:name,Ip:ip,ContainerId:containerInfo.Id,fk_org_id:orgId};
            mysql.query("insert into peernode set ?",data,function(err,results,fields){});
        }
        //如果存在，则查看containId是否变化，变化则更新
        if(results.length ==1){
            if(results[0].ContainerId !=containerInfo.Id){
                var updateData =[ip,containerInfo.Id,results[0].pk_Id];
                mysql.query("update peernode set Ip=?, ContainerId=? where pk_Id=?",updateData,function(err,results,fields){});
            }
        }


    });
}

// set up the client and channel objects for each org
for (let key in ORGS) {
	if (key.indexOf('org') === 0) {
		let client = new hfc();

		let cryptoSuite = hfc.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(ORGS[key].name)}));
		client.setCryptoSuite(cryptoSuite);

		//let channel = client.newChannel(hfc.getConfigSetting('channelName'));
		//channel.addOrderer(newOrderer(client));

		clients[key] = client;
		//channels[key] = channel;

		//setupPeers(channel, key, client);
		let caUrl = ORGS[key].ca;
		caClients[key] = new copService(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite);
	}
}

//init channel object from table channel of database  ---lmh 20170913
//step1.find all channel info from database
mysql.query("select * from channel ",function(err,results,fields){
    if(results.length >= 1){
        for(let record in results ){
        	var channelName= results[record].channelName;
        	var joinPeers=results[record].joinPeers;
            logger.debug('channelName:'+channelName+",joinPeers:"+joinPeers);

			if(joinPeers!=null && joinPeers!=""){
            var joinOrgPeers_arr=joinPeers.split(";"); //like org1Name.peerName,org1Name.peerName;org2Name.peerName,org2Name.peerName...
             var channelOrg={};
            for(let x in joinOrgPeers_arr)
			{
				//get orgName from joinPeers field
				var first_org_peer=joinOrgPeers_arr[x].split(",")[0]; //get first org_peer of OrgPeers
                var orgName=first_org_peer.split(".")[0];
				 var userInput_orgName=orgName.substr(3); //del 'org’ prefix
				var key_orgName="peerOrg"+userInput_orgName;
                //init fabric client and newChannel  through orgName
                //let client = new hfc();
                //let cryptoSuite = hfc.newCryptoSuite();
                //cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(key_orgName)})); //"peerOrgorg1"
                //client.setCryptoSuite(cryptoSuite);
                //var  channel = client.newChannel(channelName);
                var channel=clients[orgName].newChannel(channelName);
                channel.addOrderer(newOrderer(clients[orgName]));
                
                var joinPeers=joinOrgPeers_arr[x].split(",");
                for(let y in joinPeers)
				{
                    var peerName=joinPeers[y].split(".")[1];
                    //setupPeer(channel,orgName,clients[orgName],peerName);
                    var data = fs.readFileSync(path.join(__dirname, ORGS[orgName].peers[peerName]['tls_cacerts']));
                  var  peer = clients[orgName].newPeer(
                  ORGS[orgName].peers[peerName].requests,
                 {
                   pem: Buffer.from(data).toString(),
                   'ssl-target-name-override': ORGS[orgName].peers[peerName]['server-hostname']
                 }
            );
              peer.setName(peerName);

                   channel.addPeer(peer);
                      logger.debug("*******addPeer:"+peer);

				}
                 channelOrg[orgName]=channel;   
                 logger.debug("***********************99999999999999 channelOrg[orgName]:"+channelOrg[orgName]+",channel:"+channel+",peersNum:"+channel.getPeers());
                        for(var m in channel)
                          {
                             logger.debug("****"+m+":"+channel[m]+";");
                           }
                 
			}
            channels[channelName] = channelOrg;
			}
		}
    }
})

//add  one peer in channel,key is the peerName,like "peer1 or peer2 ..."
function setupPeer(channel, org, client,key) {
        let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers[key]['tls_cacerts']));
        let peer = client.newPeer(
            ORGS[org].peers[key].requests,
            {
                pem: Buffer.from(data).toString(),
                'ssl-target-name-override': ORGS[org].peers[key]['server-hostname']
            }
        );
        peer.setName(key);

        channel.addPeer(peer);
}

function setupPeers(channel, org, client) {
	for (let key in ORGS[org].peers) {
		let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers[key]['tls_cacerts']));
		let peer = client.newPeer(
			ORGS[org].peers[key].requests,
			{
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[org].peers[key]['server-hostname']
			}
		);
		peer.setName(key);

		channel.addPeer(peer);
	}
}

function newOrderer(client) {
	var caRootsPath = ORGS.orderer.tls_cacerts;
	let data = fs.readFileSync(path.join(__dirname, caRootsPath));
	let caroots = Buffer.from(data).toString();
	return client.newOrderer(ORGS.orderer.url, {
		'pem': caroots,
		'ssl-target-name-override': ORGS.orderer['server-hostname']
	});
}

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

function getOrgName(org) {
	return ORGS[org].name;
}

function getKeyStoreForOrg(org) {
	return hfc.getConfigSetting('keyValueStore') + '_' + org;
}

function newRemotes(names, forPeers, userOrg) {
	let client = getClientForOrg(userOrg);

	let targets = [];
	// find the peer that match the names
	for (let idx in names) {
		let peerName = names[idx];
		if (ORGS[userOrg].peers[peerName]) {
			// found a peer matching the name
			let data = fs.readFileSync(path.join(__dirname, ORGS[userOrg].peers[peerName]['tls_cacerts']));
			let grpcOpts = {
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[userOrg].peers[peerName]['server-hostname']
			};

			if (forPeers) {
				targets.push(client.newPeer(ORGS[userOrg].peers[peerName].requests, grpcOpts));
			} else {
				let eh = client.newEventHub();
				eh.setPeerAddr(ORGS[userOrg].peers[peerName].events, grpcOpts);
				targets.push(eh);
			}
		}
	}

	if (targets.length === 0) {
		logger.error(util.format('Failed to find peers matching the names %s', names));
	}

	return targets;
}

//-------------------------------------//
// APIs
//-------------------------------------//
var getChannelForOrg = function(channelName,orgName) {  //edit by lmh 20170904 ,content:add channelName
	return channels[channelName][orgName];
};

var getClientForOrg = function(org) {
	return clients[org];
};

var newPeers = function(names, org) {
	return newRemotes(names, true, org);
};

var newEventHubs = function(names, org) {
	return newRemotes(names, false, org);
};

var getMspID = function(org) {
	logger.debug('Msp ID : ' + ORGS[org].mspid);
	return ORGS[org].mspid;
};

var getAdminUser = function(userOrg) {
	var users = hfc.getConfigSetting('admins');
	var username = users[0].username;
	var password = users[0].secret;
	var member;
	var client = getClientForOrg(userOrg);

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				// need to enroll it with CA server
				return caClient.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');
					member = new User(username);
					member.setCryptoSuite(client.getCryptoSuite());
					return member.setEnrollment(enrollment.key, enrollment.certificate, getMspID(userOrg));
				}).then(() => {
					return client.setUserContext(member);
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ?
						err.stack : err);
					return null;
				});
			}
		});
	});
};

var getRegisteredUsers = function(username, userOrg, isJson) {
	var member;
	var client = getClientForOrg(userOrg);
	var enrollmentSecret = null;
	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				return getAdminUser(userOrg).then(function(adminUserObj) {
					member = adminUserObj;
					return caClient.register({
						enrollmentID: username,
						affiliation: userOrg + '.department1'
					}, member);
				}).then((secret) => {
					enrollmentSecret = secret;
					logger.debug(username + ' registered successfully');
					return caClient.enroll({
						enrollmentID: username,
						enrollmentSecret: secret
					});
				}, (err) => {
					logger.debug(username + ' failed to register');
					return '' + err;
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
							'Error:')) {
						logger.error(username + ' enrollment failed');
						return message;
					}
					logger.debug(username + ' enrolled successfully');

					member = new User(username);
					member._enrollmentSecret = enrollmentSecret;
					return member.setEnrollment(message.key, message.certificate, getMspID(userOrg));
				}).then(() => {
					client.setUserContext(member);
					return member;
				}, (err) => {
					logger.error(util.format('%s enroll failed: %s', username, err.stack ? err.stack : err));
					return '' + err;
				});;
			}
		});
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully',
			};
			return response;
		}
		return user;
	}, (err) => {
		logger.error(util.format('Failed to get registered user: %s, error: %s', username, err.stack ? err.stack : err));
		return '' + err;
	});
};

var getOrgAdmin = function(userOrg) {
	var admin = ORGS[userOrg].admin;
	var keyPath = path.join(__dirname, admin.key);
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	var certPath = path.join(__dirname, admin.cert);
	var certPEM = readAllFiles(certPath)[0].toString();

	var client = getClientForOrg(userOrg);
	var cryptoSuite = hfc.newCryptoSuite();
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(getOrgName(userOrg))}));
		client.setCryptoSuite(cryptoSuite);
	}

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);

		return client.createUser({
			username: 'peer'+userOrg+'Admin',
			mspid: getMspID(userOrg),
			cryptoContent: {
				privateKeyPEM: keyPEM,
				signedCertPEM: certPEM
			}
		});
	});
};

var setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, hfc.getConfigSetting('CC_SRC_PATH'));
};

var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('DEBUG');
	return logger;
};
//set channels  lmh 20170904
var setChannels = function(channels_param) {
    channels=channels_param;
};

//get channels  lmh 20170905
var getAllChannels = function() {
    return channels;
};

//get orgs  lmh 20170904
var getOrgs = function() {
    return ORGS;
};


exports.getChannelForOrg = getChannelForOrg;
exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getMspID = getMspID;
exports.ORGS = ORGS;
exports.newPeers = newPeers;
exports.newEventHubs = newEventHubs;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getOrgAdmin = getOrgAdmin;
exports.setChannels = setChannels;
exports.getAllChannels = getAllChannels;
exports.getOrgs = getOrgs;
exports.newOrderer= newOrderer;
