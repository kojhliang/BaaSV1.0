/**
 * Created by ucs_yangqihua on 2017/9/12.
 */

    var peerIntf = require('../../../hyperledgerpeerintf/hyperledgerpeerintf');
	var render = require( '../../../webcontent/dynamic/');
	var mysql = require('../../../hyperledgerpeerintf/mysqlUnit');
	var exec = require('child_process').exec;
    var log4js = require('log4js');
    var logger = log4js.getLogger('channel-server');
    logger.level='DEBUG';


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
	
	
	var newOrEditChannel = function(req, res, next) {
			var channelName = req.params.channelName;
			var peerIds = req.params.peerId;
			var peerIdArray = peerIds.split(",");  //第四步插入数据库记录时会用到
            var arr_orgName={}; //第二步创建管道的时候需要用到组织名
            var channelOrg={};
            var initResult={};         //根据用户选择的peers列表，得到的joinpeer和includeOrg结果集
            var type=req.params.type; //new:新增管道，edit:修改管道
           logger.debug('*******req.params:');
           logger.debug( req.params);



        //创建或者修改管道---第一步：根据用户输入的管道名和peers列表查询数据库，得到初始化参数channelOrg
        function setInitParams(){
            logger.debug('********创建或修改管道--第一步:根据用户输入的管道名和peers列表查询数据库，得到初始化参数channelOrg');
            var p = new Promise(function(resolve, reject) {  //必须要写resolve和reject，这是固定的
                var sql = "select group_concat(concat(concat(b.orgName, \".\"), a.PeerId) SEPARATOR \";\") as joinpeer, group_concat(distinct b.orgName) as includeOrg, group_concat(a.PeerId) as peers\
								from peernode a\
								inner join org b\
								on b.pk_Id = a.fk_org_Id\
								where a.pk_Id in (" + peerIds + ")";
                mysql.query(sql, [], function(err, result, field){
                    if(err==null) {
                        initResult=result[0];
                        arr_orgName=result[0].includeOrg.split(",")
                        channelOrg = getChannelOrgPeersFromJoinPeers(result[0].joinpeer); //修改管道的时候也会初始化
                        logger.debug('********设置channelOrg对象成功！');
                        resolve("OK")
                    }else{
                        reject(err);
                    }
                });
            });
            return p;
        }

        //创建或者修改管道---第二步：调用peerIntf的createChannel接口去调用Balance-transfer后台的createChannel接口
       function createChannelByChannelName(data){
           logger.debug('********创建或修改管道--第二步:开始调用peerIntf的createChannel接口去调用Balance-transfer后台的createChannel接口');
           var p = new Promise(function(resolve, reject) {  //必须要写resolve和reject，这是固定的
               if(type=="add") {   //新增管道的操作才需要调用接口，修改管道直接跳过这一步
                   var param = {
                       "channelName": channelName,
                       "channelConfigPath": ""
                   }
                   logger.debug('********！！！！！！！！创建或修改管道，使用创建管道的组织是:'+arr_orgName[0]);
                   peerIntf.createChannel(param, function (createChannelResult) {
                       logger.debug("********createChannelResult:" + createChannelResult.success + ",message:" + createChannelResult.message);
                       console.log("********createChannelResult:" + createChannelResult.success + ",message:" + createChannelResult.message);
                       var success = "" + createChannelResult.success;
                       if (success == "false") {
                           console.log("********创建管道失败!");
                           logger.debug("********创建管道失败!");

                           reject(createChannelResult.message)
                           //res.send(new RetMsg("500", createChannelResult.message, ""));
                       } else {
                           logger.debug('********调用Balance-transfer后台的createChannel接口成功！');
                           var start = new Date().getTime();
                           while (true)  if (new Date().getTime() - start > 5000) break;
                           resolve("OK");
                       }
                   },arr_orgName[0]);
               }else{
                   logger.debug('********修改管道不需要调用Balance-transfer后台的createChannel接口,直接跳过这一步');
                   resolve("OK");
               }
           });
           return p;
       }

        //创建或者修改管道---第三步：把peers列表加入管道,如果peers有多个组织，函数内容需要用到循环promist顺序执行
        function joinChannelByPeersList(data) {

            logger.debug('********创建或修改管道--第三步:把peers列表加入管道,如果有多个组织，函数内容需要用到循环promist顺序执行');
            var p = new Promise(function (resolve, reject) {  //必须要写resolve和reject，这是固定的
                //遍历数组对象循环执行promise
                function PromiseForEach(channel, cb) {
                    let realResult = []
                    let result = Promise.resolve();
                    for(let z in channel){
                        var start = new Date().getTime();
                        while (true)  if (new Date().getTime() - start > 500) break;
                        result = result.then(() => {
                                return cb(channel[z],z).then((res) => {
                                    realResult.push(res)
                            })
                         })
                    }
                    return result.then(() => {
                            return realResult;
                        })
                }
                //加入管道的promise
                function joinChannelForPromise(single_channelOrg,z) {
                    var p = new Promise(function (resolve, reject) {
                        var v = single_channelOrg.split(",");
                        var param = {
                            "peers": {
                                "peers": v
                            },
                            "channelName": channelName
                        };
                        peerIntf.joinChannel(param, function (joinChannelResult) {
                            console.log("********joinChannelResult:" + joinChannelResult.success + ",message:" + joinChannelResult.message);
                            logger.debug("********joinChannelResult:" + joinChannelResult.success + ",message:" + joinChannelResult.message);
                            var success = "" + joinChannelResult.success;
                            if (success == "false") {
                                console.log("********组织：" + z + "的peers:" + single_channelOrg + "加入管道" + channelName + "失败！原因:" + joinChannelResult.message);
                                logger.debug("********组织：" + z + "的peers:" + single_channelOrg + "加入管道" + channelName + "失败！原因:" + joinChannelResult.message);
                                reject(joinChannelResult.message);
                                //resolve(new RetMsg("500", joinChannelResult.message, ""));
                            } else {
                                console.log("********组织：" + z + "的peers:" + single_channelOrg + "加入管道" + channelName + "成功！");
                                logger.debug("********组织：" + z + "的peers:" + single_channelOrg + "加入管道" + channelName + "成功！" );
                                  resolve("OK")
                            }

                           }, z);
                    });
                    return p;
                }
                 //循环顺序调用promise
                return PromiseForEach(channelOrg, joinChannelForPromise).then((data) => {
                    logger.debug('********把peers列表加入管道成功！');
                      resolve(data);
                 }).catch((err) => {
                    reject(err);
                 });
            });
            return p;
        }

        //创建或修改管道---第四步：写入相应的数据库记录
        function writeDataBaseRecord(data) {
            logger.debug('********创建或修改管道--第四步:写入相应的数据库记录，包括channel表，channel_org表和channel_peernode表');
            var p = new Promise(function (resolve, reject) {  //必须要写resolve和reject，这是固定的
                //1.先查找channel表是否存在channelName的记录，如果没有，则新增插入channel表记录,如果已经存在，则更新记录的joinPeers和includeOrgs
                var createTime = new Date().Format("yyyy-MM-dd hh:mm:ss");
                var channelId="";  //后面两条sql语句都会用到这条语句
                var channel_sql="";     //第二步插入或更新channel表需要用到
                var channelPeernode_sql="";     //第三步插入channelPeernode表需要用到
                var channelOrg_sql="";     //第四步插入channelOrg表需要用到

                //1.初始化需要的参数，包括channelId和channel_sql
                function initParams() {
                    var p = new Promise(function (resolve, reject) {
                        mysql.query("select * from channel where channelName='" + channelName + "'", function (err, results, fields) {
                            console.log("********select * from channel where channelName='" + channelName + "',result:");
                            console.log(results);
                            logger.debug('*********initResult:');
                            logger.debug(initResult);
                            if (err == null) {
                                //1.1构造channel_sql和设置修改管道时的channelId
                                if (results == null || results.length == 0) { //新增管道的情况
                                    channel_sql = "insert into channel (channelName,joinPeers,includeOrgs,createTime,isOk) VALUES('" + channelName + "','" + initResult.joinpeer + "','" + initResult.includeOrg + "','" + createTime + "',1)";
                                    resolve("ok");
                                } else {  //修改管道的情况，需要拼接原来的joinPeers和includeOrgs
                                    var origin_joinPeers = results[0].joinPeers;
                                    var origin_includeOrgs = results[0].includeOrgs.split(",");
                                    //拼接最终的joinPeers字段内容
                                    var result_joinPeers = origin_joinPeers +";"+ initResult.joinpeer;
                                    console.log("********result_joinpeers:" + result_joinPeers);
                                    //拼接最终的includeOrgs字段内容
                                    var new_includeOrgs = initResult.includeOrg.split(",");
                                    for (let x in new_includeOrgs) {
                                        var flag = true;
                                        for (let y in origin_includeOrgs) {
                                            if (origin_includeOrgs[x] == new_includeOrgs[y]) {
                                                flag = false;
                                            }
                                        }
                                        if (flag == true) {
                                            origin_includeOrgs.push(new_includeOrgs[x]);
                                        }
                                    }
                                    var result_includeOrgs="";
                                    for (let x in origin_includeOrgs) {
                                        result_includeOrgs = result_includeOrgs + origin_includeOrgs[x] + ",";
                                    }
                                    result_includeOrgs = result_includeOrgs.substring(0, result_includeOrgs.length - 1)
                                    channel_sql = "update channel  set joinPeers='" + result_joinPeers + "',includeOrgs='" + result_includeOrgs + "',isOk=1 where channelName='" + channelName + "'";
                                    channelId = results[0].pk_Id; //设置channelId

                                }
                                resolve("1.init channeld and channel_sql param ok!");
                            } else {
                                reject(err);
                            }
                        });
                    });
                    return p;
                }

                //2.根据channelId和channe_sql语句,执行：插入或者修改channel表记录
                function insertOrUpdateChannelRecord(data) {
                    var p = new Promise(function (resolve, reject) {
                        logger.debug(data);
                        mysql.query(channel_sql, "", function (err, results, fields) {
                            logger.debug(' err ::%j', err);
                            logger.debug(' results ::%j', results);
                            if (err == null) {
                                if (type == "add") {
                                    channelId = results.insertId;
                                }
                                resolve("2.insertOrUpdateChannelRecord ok!");
                            } else {
                                reject(err)
                            }
                        });
                    });
                    return p;
                }

                //3.根据新增或修改channel表记录得到的channelId和peerIdArray，构造channelPeernode_sql和channelOrg_sql
                function generateChannelPeernodeAndChannelOrgSQL(data) {
                    var p = new Promise(function (resolve, reject) {
                        logger.debug(data);
                        //1.2构造channelPeernode_sql
                        channelPeernode_sql = "insert ignore into channel_peernode(channelid, peernodeid) values";
                        for (var i = 0; i < peerIdArray.length; i++) {
                            if (i != 0) {
                                channelPeernode_sql += ",";
                            }
                            channelPeernode_sql += "(" + channelId + "," + peerIdArray[i] + ")"
                        }
                        //1.3构造channelOrg_sql
                        channelOrg_sql = "insert ignore into channel_org(channelid, orgid) select " + channelId + ", fk_org_id from peernode where pk_id in (";
                        for (var i = 0; i < peerIdArray.length; i++) {
                            if (i != 0) {
                                channelOrg_sql += ",";
                            }
                            channelOrg_sql += peerIdArray[i];
                        }
                        channelOrg_sql += ") group by fk_org_id";
                        resolve("3.generateChannelPeernodeAndChannelOrgSQL ok!")
                    });
                    return p;
                }

                //4.执行插入channel_org表和channel_peernode表的记录
                function executeChannelPeernodeAndChannelOrgSQL(data) {
                    var p = new Promise(function (resolve, reject) {
                        logger.debug(data);
                        //4.1插入channel_peernode
                        mysql.query(channelPeernode_sql, [], function (err, result, field) {
                            if (err == null) {
                                //3. 插入channel_org表记录
                                mysql.query(channelOrg_sql, [], function (err, result, field) {
                                    if (err == null) {
                                        resolve("4.executeChannelPeernodeAndChannelOrgSQL ok!");
                                    } else {
                                        reject(err);
                                    }
                                });
                            } else {
                                reject(err);
                            }
                        });
                    });
                    return p;
                }

                 //链式调用开始
                initParams().then(insertOrUpdateChannelRecord)
                            .then(generateChannelPeernodeAndChannelOrgSQL)
                            .then(executeChannelPeernodeAndChannelOrgSQL)
                            .then(function(data){
                                logger.debug(data);
                                logger.debug('*******写入数据库记录成功');
                                resolve("writeDataBaseRecord OK!")
                            })
                            .catch(function(err){
                                 logger.error('\n创建或者修改管道 \'' + channelName + '\' 失败!原因\n\n');
                                 logger.error(err);
                                 console.log('***********创建或者管道失败，原因：');  //输出前端页面控制台
                                 console.log(err);
                                 reject(""+err)
                          });

            });
            return p;
        }


        //链式调用开始
        setInitParams().then(createChannelByChannelName)
            .then(joinChannelByPeersList)
            .then(writeDataBaseRecord)
            .then(function(data){
                logger.debug(data);
                logger.debug('*******666666创建或者修改管道所有步骤执行成功！！');
                res.send(new RetMsg("200", "创建或修改管道成功！", ""));
            })
            .catch(function(err){
                logger.error('\n创建或者修改管道 \'' + channelName + '\' 失败!原因\n\n');
                logger.error(err);
                console.log('***********创建或这管道失败，原因：');  //输出前端页面控制台
                console.log(err);
                res.send(new RetMsg("500", err, ""));
            });
    }
   exports.newOrEditChannel = newOrEditChannel;

//返回的结果是一个一维数组 形如：channelOrg[orgName]="peer1,peer2"
function getChannelOrgPeersFromJoinPeers(joinPeers){
    var joinOrgPeers_arr=joinPeers.split(";"); //like org1Name.peerName;org1Name.peerName;org2Name.peerName;org2Name.peerName...
    var channelOrg={};
    for(let x in joinOrgPeers_arr) {
        var str_peers="";
        var org_peer=joinOrgPeers_arr[x].split(".");
        var orgName=org_peer[0];
        var peerName=org_peer[1];
        if(channelOrg[orgName]==null){
            channelOrg[orgName]=peerName;
        }else{
            channelOrg[orgName]=channelOrg[orgName]+","+peerName;
        }
    }
    return channelOrg;
}

   /*
						//1. 调用远程接口，创建管道
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
                            channelOrg=getChannelOrgPeersFromJoinPeers(result[0].joinpeer);
                            //channelOrg=getObjectFromJoinPeersStr(result[0].joinpeer);
                            arr_orgName=result[0].includeOrg.split(",");
							console.log("create channel param");
							console.log(param);
							peerIntf.createChannel(param, function(createChannelResult) {
                                console.log("********createChannelResult:" + createChannelResult.success + ",message:" + createChannelResult.message);
                                var success = "" + createChannelResult.success;
                                if (success == "false") {
                                    console.log("********创建管道失败");
                                    res.send(new RetMsg("500", createChannelResult.message, ""));
                                }else{
                                //2. 插入channel表记录
                                sql = "update channel set isOk=0  where channelName='"+channelName+"'";
                                mysql.query(sql, [], function (err, result, field) {
                                    console.log("********%%%%%%%%%update channel set isOk=0 result");
                                    console.log(result);
                                    sql = "select pk_Id from channel  where channelName='"+channelName+"'";
                                    mysql.query(sql, [], function (err, result, field) {
                                        console.log("********%%%%%%%%%update channel set isOk=0 result");
                                        console.log(result);
                                    var channelId = result[0].pk_Id;

                                    //3. 插入channel_peernode
                                    sql = "insert ignore into channel_peernode(channelid, peernodeid) values";
                                    for (var i = 0; i < peerIdArray.length; i++) {
                                        if (i != 0) {
                                            sql += ",";
                                        }
                                        sql += "(" + channelId + "," + peerIdArray[i] + ")"
                                    }
                                    mysql.query(sql, [], function (err, result, field) {

                                        //4. 插入channel_org
                                        sql = "insert ignore into channel_org(channelid, orgid) select " + channelId + ", fk_org_id from peernode where pk_id in (";
                                        for (var i = 0; i < peerIdArray.length; i++) {
                                            if (i != 0) {
                                                sql += ",";
                                            }
                                            sql += peerIdArray[i];
                                        }
                                        sql += ") group by fk_org_id";
                                        mysql.query(sql, [], function (err, result, field) {
                                            //等待5秒，再执行join channel操作
                                           // var start = new Date().getTime();
                                           // while (true)  if (new Date().getTime() - start > 5000) break;
                                            //
                                            var createChannelForPromise = function(single_channelOrg,z) {
                                                return new Promise(function (resolve, reject) {
                                                    var param={};   //还是要用promise.all去做
                                                    var p1=new Promise(function(data, reject) {
                                                            var v = single_channelOrg.split(",");
                                                            param = {
                                                                "peers": {
                                                                    "peers": v
                                                                },
                                                                "channelName": channelName
                                                            };
                                                    });
                                                    var p2=new Promise(function(data, reject) {
                                                        peerIntf.joinChannel(param, function (joinChannelResult) {
                                                            console.log("********joinChannelResult:" + joinChannelResult.success + ",message:" + joinChannelResult.message);
                                                            var success = "" + joinChannelResult.success;
                                                            if (success == "false") {
                                                                console.log("********组织：" + z + "的peers:" + single_channelOrg + "加入管道" + channelName + "失败,原因:" + joinChannelResult.message);
                                                                resolve(new RetMsg("500", joinChannelResult.message, ""));
                                                            } else {
                                                                //设置isOk标志为1
                                                                sql = "update  channel set isOk=1  where pk_Id = " + channelId;
                                                                mysql.query(sql, [], function (err, result, field) {
                                                                    resolve(new RetMsg("200", "组织：" + z + "的peers:" + single_channelOrg + "加入管道" + channelName + "成功！", ""));
                                                                });
                                                            }
                                                        }, z);
                                                    });
                                                    p1.then( function (resolve,reject){
                                                        var start = new Date().getTime();
                                                        while (true)  if (new Date().getTime() - start > 1000) break;
                                                        return p2;
                                                    });

                                                })
                                            }
                                            var arr_promise=[];
                                            for (let z in channelOrg) {
                                                arr_promise.push(createChannelForPromise(channelOrg[z],z));
                                            }
                                            return Promise.all(arr_promise).then( function (data,reject)
                                            {
                                                console.log("**********###################Promise.all(arr_promise) data:");
                                                console.log(data);
                                                    res.send(data);
                                                }).catch(function(err){
                                                console.log("创建管道失败！原因：");
                                                console.log(err);
                                                res.send(new RetMsg("500", ""+err, ""));
                                            });

                                        });
                                    });
                                    });
                                });
                            }
							},arr_orgName[0]);//默认以加入管道的第一个组织的token去创建管道

					});

			//console.log("error newChannel: " + e);
			//res.send(new RetMsg("500", ""+e, ""))
	};
    */


//把字符串joinPeers转换成二维数组对象
function  getObjectFromJoinPeersStr(joinPeersStr){
	var channelOrg={};
    var orgs=joinPeersStr.split(";");
    for(let x in orgs){
    	var orgPeers={};
    	var peers=orgs[x].split(",");
    	var firstpeer=peers[0].split(".");
    	var orgName=firstpeer[1];
    	for(let y in peers){
    		var peer=peers[y].split(".");
            orgPeers[peer[1]]=peers[y];   //orgPeers["peer1"]="org1.peer1"
		}
        channelOrg[orgName]=orgPeers;
	}
   return channelOrg;
}

//把二维数组对象转换成joinPeers字符串
function turnObjectToJoinPeersStr(object){
	var joinPeers="";
    for(let x in  object ){
    	 var orgPeers=object[x];
         for(let y in orgPeers){
             joinPeers=joinPeers+orgPeers[y]+","
		 }
        joinPeers=joinPeers.substring(0,joinPeers.Length-1)+";";
	}
    joinPeers=joinPeers.substring(0,joinPeers.Length-1);
	return joinPeers;
}


//返回的结果是一个一维数组 形如：channelOrg[orgName]="peer1.21,peer2.22"
function getChannelOrgPeersPkIdFromJoinPeers(joinPeers){
    var joinOrgPeers_arr=joinPeers.split(";"); //like org1Name.peerName.pkId;org1Name.peerName.pkId;org2Name.peerName.pkId;org2Name.peerName.pkId...
    var channelOrg={};
    for(let x in joinOrgPeers_arr) {
        var str_peers="";
        var org_peer=joinOrgPeers_arr[x].split(".");
        var orgName=org_peer[0];
        var peerName=org_peer[1];
        var pk_Id=org_peer[2];
        if(channelOrg[orgName]==null){
            channelOrg[orgName]=peerName+"."+pk_Id;
        }else{
            channelOrg[orgName]=channelOrg[orgName]+","+peerName+"."+pk_Id;
        }
    }
    return channelOrg;
}

function joinPeerIntoChannel(channelOrg,channelName,pkId,origin_joinPeers){
    var p = new Promise(function(resolve, reject) {
    	var length=0;
        for(var i in channelOrg){
            length++;
        }
        console.log("********channelOrg.length:"+length);
        console.log("********channelOrg:"+printMap(channelOrg));
        var resultMsg ="";
        var result_joinPeers=origin_joinPeers;
        //channelOrg=getObjectFromJoinPeersStr(result[0].joinpeer);
        //循环把peer加入管道
        var joinChannelForPromise = function(single_channelOrg,z){
        	return new Promise(function(resolve, reject) {
                var v = single_channelOrg.split(",");
                //把orgName.peerName.PkId转换成peerName的格式
                var arr_peers = {};
                var peerIdArray = {};
                var param={};
                var p1=new Promise(function(resolve, reject) {
                    for (let y in v) {
                        var tmp = v[y].split(".");
                        arr_peers[y] = tmp[0];
                    }
                    console.log("********arr_peers:" + printMap(arr_peers));
                    //把orgName.peerName.PkId转换成PkId的格式
                    for (let k in v) {
                        var tmp = v[k].split(".");
                        peerIdArray[k] = tmp[1];
                    }
                    console.log("********进入P1的promise,peerIdArray:");
                    console.log(peerIdArray);
                    param = {
                        "peers": {
                            "peers": arr_peers
                        },
                        "channelName": channelName
                    };
                    console.log("********进入P1的promise,param:");
                    console.log(param);
                });
                var p2=new Promise(function(data, reject) {
                    console.log("********进入P2的promise,org:" + z);
                    console.log("********进入P2的promise,param:" + param);
                    peerIntf.joinChannel(param, function (joinChannelResult) {
                        console.log("********joinChannelResult:" + joinChannelResult.success + ",message:" + joinChannelResult.message);
                        var success = "" + joinChannelResult.success;
                        if (success == "false") {
                            var str_peers=""
                            for(let t in arr_peers){
                                str_peers=str_peers+arr_peers[t]+",";
                            }
                            str_peers=str_peers.substring(0,str_peers.length-1)
                            console.log( z +"组织的" + str_peers + "加入"+ channelName +"管道失败,原因:" + joinChannelResult.message);
                            //resultMsg = resultMsg+ "组织：" + z + "的peers:" + channelOrg[z] + "加入管道" + channelName + "失败！原因：" + joinChannelResult.message + "\n";

                            resultMsg = resultMsg + z+ "组织" + "的" + str_peers + "加入"+ channelName+"管道"  + "失败!";
                            faild_flag = true;
                            if (count == length) {
                                console.log("***********joinPeerIntoChannel Failed!");
                                resolve(new RetMsg("500", resultMsg, ""));
                                //reject("joinPeerIntoChannel Failed!");
                            }
                        } else {
                            //2. 插入channel_peernode
                            sql = "insert ignore into channel_peernode(channelid, peernodeid) values";
                            console.log("********!!!!!!!!!!!!!!!!!!!!!!!!!!进入P2的promise,peerIdArray:");
                            console.log(peerIdArray);
                            for(let i in peerIdArray){
                                sql += "(" + pkId + "," + peerIdArray[i] + "),"
							}
                            sql=sql.substring(0,sql.length-1)
                            mysql.query(sql, [], function (err, result, field) {
                                //3. 插入channel_org
                                sql = "insert ignore into channel_org(channelid, orgid) select " + pkId + ", fk_org_id from peernode where pk_id in (";
                                for(let i in peerIdArray){
                                    sql +=  peerIdArray[i] + ","
                                }
                                sql=sql.substring(0,sql.length-1)
                                sql += ") group by fk_org_id";
                                mysql.query(sql, [], function (err, result, field) {
                                    //按组织更改channel记录的joinPeers字段内容
                                    var new_joinpeers = "";
                                    for (let x in v) {
                                        var tmp = v[x].split(".");
                                        new_joinpeers = new_joinpeers + ";" + z + "." + tmp[0];
                                    }
                                    console.log("********new_joinpeers:" + new_joinpeers);
                                    result_joinPeers = result_joinPeers + new_joinpeers;
                                    sql = "update  channel set joinPeers=\"" + result_joinPeers + "\" where pk_Id = " + pkId;
                                    mysql.query(sql, [], function (err, result, field) {
                                        //resultMsg = resultMsg + "********组织：" + z + "的peers:" + channelOrg[z] + "加入管道" + channelName + "成功 \n";
                                        resolve(new RetMsg("200", "修改管道成功！", ""));
                                    });
                                });
                            });
                        }
                    }, z);
                });
                p1.then( function (resolve,reject){
                    return p2.then( function (data,reject){
                        console.log("**********###################return p2.then data:");
                          resolve(data);
                    });
                });
            });
        }
        var arr_promise=[];
        for (let z in channelOrg) {
            arr_promise.push(joinChannelForPromise(channelOrg[z],z));
        }
         return Promise.all(arr_promise).then( function (data,reject)
         {
             console.log("**********###################Promise.all(arr_promise) data:");
             console.log(data);
             //设置isOk标志为1
             sql = "update  channel set isOk=1 where pk_Id = " + pkId;
             mysql.query(sql, [], function (err, result, field) {
                 //res.send(resolve);
                 resolve(data);
             });
         }).catch(function(err){
             console.log("修改管道失败！原因：");
             console.log(err);
             //重新设置isOk标志为1
             sql = "update  channel set isOk=1 where pk_Id = " + pkId;
             mysql.query(sql, [], function (err1, result, field) {
             });
             //res.send(new RetMsg("500", ""+err, ""));
             reject(new RetMsg("500", ""+err, ""));
         });;
    });
    return p;
}


var editChannel = function(req, res, next) {
    try {
        var channelName = "";
        var peerIds = req.params.peerId;
        var pkId = req.params.pkId;
        var peerIdArray = peerIds.split(",");
        var sql = "";
        var origin_joinPeers=""

        console.log("************peerIds  in editchannel:"+peerIds);

        sql = "select  * from channel where pk_Id="+pkId;
        mysql.query(sql, [], function(err, result, field){
            channelName=result[0].channelName;
            origin_joinPeers=result[0].joinPeers;
            console.log("************channelName:"+channelName+",origin_joinPeers:"+origin_joinPeers);
        	//1. 设置isOk为0
        sql = "update channel set isOk=0 where pk_Id="+pkId;
        mysql.query(sql, [], function(err, result, field){

                    //1. 调用远程接口，修改管道
                    sql = "select group_concat(concat(b.orgName, \".\", a.PeerId) SEPARATOR \";\") as joinpeer,\
                         group_concat(concat(b.orgName, \".\", a.PeerId,\".\",a.pk_Id) SEPARATOR \";\") as joinpeerid,\
                         group_concat(distinct b.orgName) as includeOrg, group_concat(a.PeerId) as peers\
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
                        console.log("edit channel param");
                        console.log(param);

                       channelOrg=getChannelOrgPeersPkIdFromJoinPeers(result[0].joinpeerid);
                        joinPeerIntoChannel(channelOrg,channelName,pkId,origin_joinPeers).then( function (resolve,reject)
                        {
                            console.log("joinPeerIntoChannel resolve:");
                            console.log(resolve);
                            console.log("reject:");
                            console.log(reject);
                            res.send(resolve);
                        }).catch(function(err){
                            console.log("修改管道失败！原因：");
                            console.log(err);
                            res.send(new RetMsg("500", ""+err, ""));
                        });

                });
            });
        });
    } catch(e) {
        console.log("error editChannel: " + e);
        res.send({});
    }
};
exports.editChannel = editChannel;


	
	var testShell = function(req, res, next) {
		var cmd = "ls -l";
		exec(cmd, function(err, stdout, stderr){
			console.log(stderr);
			res.send({"1": err, "2": stdout, "3": stderr});
		});
	};
	exports.testShell  = testShell;

//获得所有组织的peer信息
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

//add by lmh 获得加入某个管道的所有peer信息
var getJoinChannelPeer = function(req, res, next) {
    logger.debug("************进入getJoinChannelPeer");
    try {
        var channelId = req.params.channelId;
        var sql = "select  a.pk_Id as orgid, a.orgName, b.pk_Id as peerid, b.PeerName\
						from org a,peernode b,channel_peernode c\
						where  c.channelId="+channelId+" and b.pk_Id=c.peernodeID and b.fk_org_Id=a.pk_Id \
						order by a.orgName";
        mysql.query(sql, [], function(err, result, field){
            logger.debug("进入getJoinChannelPeer的mysql执行，结果是：");
            logger.debug(result[0]);
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
exports.getJoinChannelPeer = getJoinChannelPeer;

function RetMsg(code,msg,data) {
    this.code = code;
    this.msg = msg;
    this.data = data;
}

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