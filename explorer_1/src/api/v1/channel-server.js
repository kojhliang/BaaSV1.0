/**
 * Created by ucs_yangqihua on 2017/9/12.
 */

    var peerIntf = require('../../../hyperledgerpeerintf/hyperledgerpeerintf');
	var render = require( '../../../webcontent/dynamic/');
	var mysql = require('../../../hyperledgerpeerintf/mysqlUnit');
	var exec = require('child_process').exec;


	
	var getChannel = function(req, res, next) {
		try {
            if(req.query.page <1){
                return res.send(new RetMsg("100","页数不能小于1",""));
            }
            var size = parseInt(req.query.size);
            var pageStart =(req.query.page-1)*size;
            var count =0;

			var sql = "select count(*) as count, channel.pk_id, channel.channelname, \
						ifnull(a.peerCount, 0) as peerCount, ifnull(b.orgCount, 0) as orgCount, ifnull(c.chaincodeCount, 0) as chaincodeCount\
						from channel channel\
						left join (\
						select a.pk_id, count(1) as peerCount\
						from channel a\
						inner join channel_peernode b\
						on a.pk_Id = b.channelId\
						group by a.pk_id\
						) a\
						on channel.pk_Id = a.pk_id\
						left join (\
						select a.pk_id, count(1) as orgCount\
						from channel a\
						inner join channel_org b\
						on a.pk_id = b.channelId\
						group by a.pk_Id\
						) b\
						on b.pk_id = a.pk_id\
						left join (\
						select a.pk_id, count(1) as chaincodeCount\
						from channel a\
						inner join deploychaincode b\
						on b.channelId = a.pk_id\
						group by a.pk_id\
						) c\
						on c.pk_id = a.pk_id order by pk_Id desc limit "+pageStart+","+size;
			var dataSql = sql.replace("count(*) as count,","");
			var countSql = sql.replace("order by pk_Id desc limit "+pageStart+","+size,"");
			mysql.query(countSql, [], function(err, result, field){
				console.log(result);
                count = result[0].count;
                mysql.query(dataSql, [], function(err, results, field){
                    var data={"count":count,"data":results};
                    return res.send(new RetMsg("200","查询成功",data));
                });

			});
		}catch(e){
			console.log("error getChannel: " + e);
			res.send({});
		}
	};
	exports.getChannel = getChannel;
	
	
	var getPeerByChannelId = function(req, res, next) {
		try {
			var channelId = req.params.channelId;
			var sql = "select a.channelName, a.pk_Id, c.PeerName, c.Ip, c.pk_Id as peerId, d.orgName\
						from channel a\
						inner join channel_peernode b\
						on b.channelId = a.pk_Id\
						inner join peernode c\
						on c.pk_Id = b.peernodeID\
						inner join org d\
						on d.pk_Id = c.fk_org_Id\
						where a.pk_Id = " + channelId;
			mysql.query(sql, [], function(err, result, field){
				res.send(result);
			});
		} catch(e) {
			console.log("error getPeerByChannelId: " + e);
			res.send({});
		}
	};
	exports.getPeerByChannelId = getPeerByChannelId;
	
	
	
	var getOrgByChannelId = function(req, res, next) {
		try {
			var channelId = req.params.channelId;
			var sql = "select a.pk_Id, d.orgName, ifnull(c.peerCount, 0) as peerCount\
						from channel a\
						inner join channel_org b\
						on b.channelId = a.pk_Id\
						inner join org d\
						on d.pk_Id = b.orgId\
						left join\
						(select a.pk_id, count(1) as peerCount\
						from channel a\
						inner join channel_peernode b\
						on b.channelId = a.pk_Id\
						group by a.pk_id\
						) c\
						on c.pk_id = a.pk_id\
						where a.pk_Id = " + channelId;
			mysql.query(sql, [], function(err, result, field){
				res.send(result);
			});
		} catch(e) {			
			console.log("error getOrgByChannelId: " + e);
			res.send({});
		}
	};
	exports.getOrgByChannelId = getOrgByChannelId;
	
	var getInstalledChaincodeByChannelId = function(req, res, next) {
		try {
			var channelId = req.params.channelId;
			var sql = "select b.channelName, a.ChaincodeName, a.installPeers\
						from deploychaincode a\
						inner join channel b\
						on a.channelId = b.pk_Id\
						where a.channelId = " + channelId;
			mysql.query(sql, [], function(err, result, field){
				if(result && result[0] && result[0].installPeers) {
					var installPeers = result[0].installPeers;
					var installPeersCount = installPeers.split(",").length;
					result[0].installPeersCount = installPeersCount + "";
				}
				res.send(result);
			});
		} catch(e) {			
			console.log("error getInstalledChaincodeByChannelId: " + e);
			res.send({});
		}
	};
	exports.getInstalledChaincodeByChannelId = getInstalledChaincodeByChannelId;
	
	
	var newChannel = function(req, res, next) {
		try {
			var channelName = req.params.channelName;
			var peerIds = req.params.peerId;
			var peerIdArray = peerIds.split(",");
			var sql = "";
			
			//1. 插入channel
			sql = "insert into channel(channelName, createTime) values('"+ channelName + "', now())";
			mysql.query(sql, [], function(err, result, field){
				var channelId = result.insertId;
				
				//2. 插入channel_peernode
				sql = "insert into channel_peernode(channelid, peernodeid) values";
				for(var i = 0; i < peerIdArray.length; i++) {
					if(i != 0) {
						sql += ",";
					} 
					sql += "(" + channelId + "," + peerIdArray[i] + ")"
				}
				mysql.query(sql, [], function(err, result, field){
					
					//3. 插入channel_org
					sql = "insert into channel_org(channelid, orgid) select " + channelId + ", fk_org_id from peernode where pk_id in (";
					for(var i = 0; i < peerIdArray.length; i++) {
						if(i != 0) {
							sql += ",";
						} 
						sql += peerIdArray[i];
					}
					sql += ")";
					mysql.query(sql, [], function(err, result, field){
						
						
						//4. 调用远程接口，创建管道
						sql = "select group_concat(concat(concat(b.orgName, \".\"), a.PeerId) SEPARATOR \";\") as joinpeer, group_concat(distinct b.orgName) as includeOrg, group_concat(a.PeerId) as peers\
								from peernode a\
								inner join org b\
								on b.pk_Id = a.fk_org_Id\
								where a.pk_Id in (" + peerIds + ")";
						mysql.query(sql, [], function(err, result, field){
							var param = {
								"channelName": channelName,
								"channelConfigPath": "",
								"joinPeers": result[0].joinpeer,
								"includeOrgs": result[0].includeOrg
							};
							console.log("createchannel param");
							console.log(param);
							peerIntf.createChannel(param, function(createChannelResult){
								console.log(createChannelResult);
								var v = result[0].peers.split(",");
								param = {
									"peers": {
										"peers": v
									},
									"channelName": channelName
								};
								//等待5秒，再执行join channel操作
								var start = new Date().getTime();
								while(true)  if(new Date().getTime()-start > 5000) break;
								//
								peerIntf.joinChannel(param, function(joinChannelResult){
									console.log(joinChannelResult);
									res.send(new RetMsg("200","操作成功",""));
								});
							});
						});
					});
				});
			});
			
			
		} catch(e) {			
			console.log("error newChannel: " + e);
			res.send({});
		}
	};
	exports.newChannel = newChannel;
	
	var testShell = function(req, res, next) {
		var cmd = "ls -l";
		exec(cmd, function(err, stdout, stderr){
			console.log(stderr);
			res.send({"1": err, "2": stdout, "3": stderr});
		});
	};
	exports.testShell  = testShell;
	
	var getOrgAndPeer = function(req, res, next) {
		
		try {
			var channelId = req.params.channelId;
			var sql = "select  a.pk_Id as orgid, a.orgName, b.pk_Id as peerid, b.PeerName\
						from org a\
						left join peernode b\
						on b.fk_org_Id = a.pk_Id\
						order by a.orgName";
			mysql.query(sql, [], function(err, result, field){
				console.log(result[0]);
				var data = result;
				var retResult = [];
				var retResultIndex = -1;
				var childrenIndex = 0;
				var orgName = "";
				for(var i = 0; i < data.length; i++) {
					console.log("data[i].orgName");
					console.log(data[i].orgName);
					if(data[i].orgName != orgName) {
						retResultIndex++;
						childrenIndex = 0;
						orgName = data[i].orgName;
						retResult[retResultIndex] = {};
						retResult[retResultIndex].name = data[i].orgName;
                        retResult[retResultIndex].open = true;
						retResult[retResultIndex].nocheck = true;
						retResult[retResultIndex].children = [];
						console.log("retResult[retResultIndex]");
						console.log(retResult[retResultIndex]);
					} 
					retResult[retResultIndex].children[childrenIndex] = {
						"name": data[i].PeerName,
						"checked": false,
						"id": data[i].peerid,
						"pId": data[i].orgid
					};
					childrenIndex++;
				}
				res.send(retResult);
			});
		} catch(e) {			
			console.log("error getInstalledChaincodeByChannelId: " + e);
			res.send({});
		}
	};
	exports.getOrgAndPeer = getOrgAndPeer;

function RetMsg(code,msg,data) {
    this.code = code;
    this.msg = msg;
    this.data = data;
}