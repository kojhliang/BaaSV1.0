/**
 * Created by ucs_yangqihua on 2017/9/12.
 */
    var peerIntf = require('../../../hyperledgerpeerintf/hyperledgerpeerintf');
	var render = require( '../../../webcontent/dynamic/');
	var mysql = require('../../../hyperledgerpeerintf/mysqlUnit');
    var log4js = require('log4js');
    var logger = log4js.getLogger('chaincode-server');
    logger.level='DEBUG';

	var getChaincode = function(req, res, next) {
		try {
            console.log( 'getChaincode');
            if(req.query.page <1){
                return res.send(new RetMsg("100","页数不能小于1",""));
            }
            var size = parseInt(req.query.size);
            var pageStart =(req.query.page-1)*size;
            var count =0;
            mysql.query("select count(*) as count from uploadchaincode","",function(err,results,fields){
                count = results[0].count;
                mysql.query("select * from uploadchaincode limit ?,?",[pageStart,size],function(err,results,fields){
                    //  var obj = JSON.parse(JSON.stringify(results));
                    var data={"count":count,"data":results};
                    return res.send(new RetMsg("200","查询成功",data));
                });
            });
		} catch(e) {			
			console.log("error getChaincode: " + e);
			res.send({});
		}
	};
	exports.getChaincode = getChaincode;
	
	var newDeployChaincode = function(req, res, next) {
			var channelId = req.params.channelId;
			var chaincodeName = req.params.chaincodeName;
			var chaincodeVersion = req.params.chaincodeVersion;
            var uploadchaincode_Id = req.params.uploadchaincode_Id;

            var data = {chaincodename:chaincodeName,version:chaincodeVersion,channelId:channelId,fk_uploadchaincode_Id:uploadchaincode_Id};
			var sql = "insert into deploychaincode set ?";
			mysql.query(sql, data, function(err, result, field){
                        if(err==null){
                            res.send(new RetMsg("200","操作成功",null));
                        }else{
                            res.send(new RetMsg("500",""+err,null));
                        }

			});
	};
	exports.newDeployChaincode = newDeployChaincode;
	
	
	var getDeployChaincode = function(req, res, next) {
		try {
            if(req.query.page <1){
                return res.send(new RetMsg("100","页数不能小于1",""));
            }
            var size = parseInt(req.query.size);
            var pageStart =(req.query.page-1)*size;
            var count =0;
			var sql = "select count(*) as count, a.pk_id,a.channelId,a.installPeers,a.Status, a.ChaincodeName, a.version, b.channelName, a.Params ,c.Name as uploadchaincodeName\
						from deploychaincode a\
						left join channel b\
						on b.pk_Id = a.channelId\
						left join uploadchaincode c on a.fk_uploadchaincode_Id =c.pk_Id \
						 order by pk_Id desc limit "+pageStart+","+size;

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
		} catch(e) {			
			console.log("error getDeployChaincode: " + e);
			res.send({});
		}
	};
	exports.getDeployChaincode = getDeployChaincode;


	function installChaincodeFunction(deployChaincodeId,peerId){
            var orgPeers = {};
            var deployChaincode = {};
            var add_PeerId = ""; //要添加插入的新peerId
            var err_data = "";  //保存最终返回的错误信息

            //安装智能合约---第一步：根据用户输入的peers列表查询数据库，得到初始化参数orgPeers和deployChaincode对象
            function setInitParams() {
                logger.debug('********安装智能合约--第一步:根据用户选择安装智能合约的peers列表查询数据库，得到初始化参数orgPeers和deployChaincode对象');
                var p = new Promise(function (resolve, reject) {  //必须要写resolve和reject，这是固定的
                    //要得到形如orgName.PeerName.PeerId;orgName.PeerName.PeerId;这样的结果
                    var sql = "select group_concat(concat(b.orgName, \".\", a.PeerId,\".\",a.pk_Id) SEPARATOR \";\") as joinpeer \
								from peernode a\
								inner join org b\
								on b.pk_Id = a.fk_org_Id\
								where a.pk_Id in (" + peerId + ")";
                    mysql.query(sql, [], function (err, result, field) {
                        if (err == null) {
                            orgPeers = getChannelOrgPeersFromJoinPeers(result[0].joinpeer);//得到的结果为 ｛"org1":"peer1.23,pee2.24","org2": "peer1.21,pee2.22"｝
                            logger.debug('********设置channelOrg对象成功！');
                            sql = "select a.ChaincodeName as ChaincodeName,a.installPeers as installPeers, b.MainPath as MainPath, a.version as version \
							from deploychaincode a\
							left join uploadchaincode b\
							on a.fk_uploadchaincode_Id = b.pk_Id\
							where a.pk_id = " + deployChaincodeId;
                            mysql.query(sql, [], function (err, result, field) {
                                if (result == null || result.length == 0) {
                                    //res.send(new RetMsg(100, "操作失败，此智能合约不存在", null));
                                    reject("操作失败，此智能合约不存在")
                                } else {
                                    deployChaincode = result[0];
                                    resolve("OK")
                                }
                            });
                        } else {
                            reject(err);
                        }
                    });
                });
                return p;
            }

            //安装智能合约---第二步：安装智能合约到某个组织的peers列表，函数内容需要用到循环promist顺序执行,得到最终要更新deploychaincode表的installPeers字段
            function installChaincodeByOrgPeers(data) {
                logger.debug('********安装智能合约--第二步:按组织把不同组织的peers列表加入管道，函数内容需要用到循环promist顺序执行');
                logger.debug("*****orgPeers:");
                logger.debug(orgPeers);

                var all_p = new Promise(function (resolve, reject) {  //必须要写resolve和reject，这是固定的

                    //遍历数组对象循环执行promise
                    function PromiseForEach(channel, cb) {
                        let realResult = []
                        let result = Promise.resolve();
                        for (let z in channel) {
                            var start = new Date().getTime();
                            while (true)  if (new Date().getTime() - start > 500) break;
                            result = result.then(() => {
                                    return cb(channel[z], z).then((res) => {
                                        realResult.push(res)
                                }
                        )
                        })
                        }
                        return result.then(() => {
                                return realResult;
                    })
                    }

                    //安装智能合约的promise
                    function installChaincodeForPromise(single_orgPeers, z) {
                        logger.debug("*****进入installChaincodeForPromise");
                        var p = new Promise(function (resolve, reject) {


                            //安装智能合约---第二步--分步骤1：安装智能合约到某个组织的peers列表，得到最终要更新deploychaincode表的installPeers字段
                            function installChaincodeStep1(single_orgPeers, z) {
                                var p1 = new Promise(function (resolve, reject) {
                                    var arr_peerName_peerId = single_orgPeers.split(",");
                                    var arr_peerName = {};
                                    var arr_peerId = {};
                                    for (let m in arr_peerName_peerId) {
                                        var peerName = arr_peerName_peerId[m].split(".")[0];
                                        arr_peerName[m] = peerName;
                                    }
                                    for (let n in arr_peerName_peerId) {
                                        var peerId = arr_peerName_peerId[n].split(".")[1];
                                        arr_peerId[n] = peerId;
                                    }

                                    var param = {
                                        "peers": arr_peerName,
                                        "chaincodeName": deployChaincode.ChaincodeName,
                                        "chaincodePath": deployChaincode.MainPath,
                                        "chaincodeVersion": deployChaincode.version
                                    };
                                    logger.debug("********param:");
                                    logger.debug(param);
                                    //installPeerResult返回的是一个数组对象
                                    peerIntf.installPeer(param, function (installPeerResult) {
                                        logger.debug("********installPeerResult:");
                                        logger.debug(installPeerResult);
                                        var success = "" + installPeerResult.success;
                                        //检查是否有些peer是安装成功的，如果有则也要更新deploychaincode表的installPeers和status字段
                                        for (let i in installPeerResult.data) {
                                            if (installPeerResult.data[i].status == 200) {
                                                add_PeerId = add_PeerId + arr_peerId[i] + ",";
                                            } else {
                                                err_data = err_data + installPeerResult.data[i].message + "\n";
                                            }
                                        }
                                        if (success == "false") {
                                            logger.debug("********组织：" + z + "的peers:" + single_orgPeers + "安装智能合约" + deployChaincode.ChaincodeName + "(版本:" + deployChaincode.version + ")失败！原因:");
                                            logger.debug(installPeerResult.data);
                                            let data = {
                                                success: false,
                                                peerId: add_PeerId
                                            }
                                            resolve(data);
                                            //reject(joinChannelResult.data);
                                            //resolve(new RetMsg("500", joinChannelResult.message, ""));
                                        } else {
                                            logger.debug("********组织：" + z + "的peers:" + single_orgPeers + "安装智能合约" + deployChaincode.ChaincodeName + "(版本:" + deployChaincode.version + ")成功！");
                                            let data = {
                                                success: true,
                                                peerId: add_PeerId
                                            }
                                            resolve(data)
                                        }
                                    }, z);

                                });
                                return p1;
                            }


                            installChaincodeStep1(single_orgPeers, z).then(function (data) {
                                resolve(data);
                            }).catch(function (err) {
                                reject(err);
                            });
                        });
                        return p;
                    }

                    //循环顺序调用promise
                    return PromiseForEach(orgPeers, installChaincodeForPromise).then((data) => {
                            resolve(data);
                }).catch((err) => {
                        reject(err);
                })
                    ;
                });
                return all_p;
            }

            //安装智能合约---第三步--根据得到的某个组织的installPeers字段，插入deploychaincode表
            function writeDataBaseRecord(data) {
                logger.debug("*****进入writeDataBaseRecord");
                logger.debug("*****data");
                logger.debug(data);
                var p = new Promise(function (resolve, reject) {
                    //更新数据库
                    if (add_PeerId != "") {   //新安装的peerId不为空才需要更新数据库
                        var result_PeerIds = "";
                        if (deployChaincode.installPeers == null || deployChaincode.installPeers == "") {
                            deployChaincode.installPeers = "";
                        } else {
                            deployChaincode.installPeers = deployChaincode.installPeers + ",";
                        }

                        add_PeerId = add_PeerId.substring(0, add_PeerId.length - 1);
                        result_PeerIds = deployChaincode.installPeers + add_PeerId;
                        var status = 1; //已安装智能合约状态
                        var sql = "update deploychaincode set installPeers = '" + result_PeerIds + "' ,Status = " + status + " where pk_id = '" + deployChaincodeId + "'";
                        mysql.query(sql, [], function (err, result, field) {
                            if (err == null) {
                                logger.debug("********更新deploychaincode表成功！");
                                if (err_data == "") {
                                    resolve("ok");
                                } else {
                                    reject(err_data);
                                }
                            } else {
                                reject(err)
                            }
                        });
                    } else {
                        reject(err_data);
                    }
                });
                return p;
            }

            //链式调用开始
            return  setInitParams().then(installChaincodeByOrgPeers)
                .then(writeDataBaseRecord).then(function (data) {
                    logger.debug(data);
                    logger.debug('********6666安装智能合约所有步骤执行成功！！');
                    //res.send(new RetMsg("200", "安装智能合约" +deployChaincode.ChaincodeName+"(版本:"+deployChaincode.version+ ")成功！", ""));
                    return Promise.resolve(new  RetMsg("200", "安装智能合约" + deployChaincode.ChaincodeName + "(版本:" + deployChaincode.version + ")成功！", ""));
                }).catch(function (err) {
                    logger.error('\n安装智能合约 \'' + deployChaincode.ChaincodeName + '(版本:' + deployChaincode.version + ') \' 失败!原因\n\n');
                    logger.error(err);
                    console.log('***********安装智能合约 \'' + deployChaincode.ChaincodeName + '(版本:' + deployChaincode.version + ') \' 失败，原因：');  //输出前端页面控制台
                    console.log(err);
                    //res.send(new RetMsg("500", ""+err, ""));
                    return Promise.reject(new RetMsg("500", ""+err, ""));
                });
    }


	var installChaincode = function(req, res, next) {
           logger.debug('*******req.params:');
           logger.debug( req.params);
			var deployChaincodeId = req.params.deployChaincodeId;
			var peerId = req.params.peerId;  //这里peerId可能会包含多个组织

          installChaincodeFunction(deployChaincodeId,peerId).then(function (data) {
              res.send(data);
          }).catch(function (err) {
              res.send(err);
          });
        };
        exports.installChaincode = installChaincode;


//返回的结果是一个一维数组 形如：channelOrg[orgName]="peer1.21,peer2.22"
function getChannelOrgPeersFromJoinPeers(joinPeers){
    var joinOrgPeers_arr=joinPeers.split(";"); //like org1Name.peerName.peerId;org1Name.peerName.peerId;org2Name.peerName.peerId;org2Name.peerName.peerId...
    var channelOrg={};
    for(let x in joinOrgPeers_arr) {
        var str_peers="";
        var org_peer=joinOrgPeers_arr[x].split(".");
        var orgName=org_peer[0];
        var peerName=org_peer[1];
        var peerId=org_peer[2];
        if(channelOrg[orgName]==null){
            channelOrg[orgName]=peerName+"."+peerId;
        }else{
            channelOrg[orgName]=channelOrg[orgName]+","+peerName+"."+peerId;
        }
    }
    return channelOrg;
}

//初始化智能合约和升级智能合约需要的参数都一样，只是调用的后台接口不同
//type类型：init upgrade
function initiateOrUpgradeChaincodeFunction(deployChaincodeId,req_param,policy,type){
    var all_p = new Promise(function (resolve, reject) {
        var operate = "";
        if (type == "init") {
            operate = "初始化";
        } else {
            operate = "升级";
        }
        sql = "select b.channelName, a.ChaincodeName, a.version, a.Params\
						from deploychaincode a\
						left join channel b\
						on b.pk_Id = a.channelId\
						where a.pk_id = " + deployChaincodeId;
       mysql.query(sql, [], function (err, result, field) {
            if (err == null) {
                var param = {
                    "channelName": result[0].channelName,
                    "param": {
                        "chaincodeName": result[0].ChaincodeName,
                        "chaincodeVersion": result[0].version,
                        "args": req_param.split(",")
                    }
                };
                logger.debug("**************param:");
                logger.debug(param);
                //查询安装了智能合约的其中一个peer的所属组织名
                sql = "select a.PeerId as PeerId,b.orgName as orgName from peernode a ,org b where a.fk_org_Id=b.pk_Id and a.pk_Id in (select installPeers from deploychaincode where pk_Id=" + deployChaincodeId + ");"
                mysql.query(sql, [], function (err, result, field) {
                    if (err == null) {
                        logger.debug("**************result:");
                        logger.debug(result);
                        var orgName = result[0].orgName;
                        var peerId=result[0].PeerId;
                        param.param.peerId=peerId;

                        function writeDatabaseRecord(result) {
                            logger.debug("*************Result:");
                            logger.debug(result);
                            if (result.status == "SUCCESS") {
                                var sql = "update deploychaincode set Status =2, params = '" + req_param + "', endorsePolicy = '" + policy + "' where pk_id = '" + deployChaincodeId + "'";
                                mysql.query(sql, [], function (err, result, field) {
                                    if (err == null) {
                                        logger.debug('********6666' + operate + '智能合约所有步骤执行成功！！');
                                        //res.send(new RetMsg("200", "初始化智能合约成功！", null));
                                        resolve( new RetMsg("200", operate+'智能合约成功！', null));
                                    } else {
                                        logger.debug('********' + operate + '智能合约失败！错误信息：' + err);
                                        //res.send(new RetMsg("500", "" + err, null));
                                        reject( new RetMsg("500", "" + err, null));
                                    }
                                });
                            } else {
                                logger.debug('********' + operate + '智能合约失败！错误信息：' + result.message);
                                //res.send(new RetMsg("500", "" + instantiateResult.message, null));
                                reject(new RetMsg("500", "" + result.message, null));
                            }
                        }

                        if (type == "init") {
                            peerIntf.instantiate(param, function (instantiateResult) {
                                return writeDatabaseRecord(instantiateResult);
                            }, orgName);
                        } else {
                            peerIntf.upgrade(param, function (upgradeResult) {
                                return writeDatabaseRecord(upgradeResult);
                            }, orgName);
                        }
                    } else {
                        logger.debug('********' + operate + '智能合约失败！错误信息：' + err);
                        // res.send(new RetMsg("500", "" + err, null));
                        return Promise.reject(new RetMsg("500", "" + err, null));
                    }
                });
            } else {
                logger.debug('********' + operate + '智能合约失败！错误信息：' + err);
                // res.send(new RetMsg("500", ""+ err, null));
                return Promise.reject(new RetMsg("500", "" + err, null));
            }
        });
    });
    return all_p.then(function (data) {
        return Promise.resolve(data);
    }).catch(function (err) {
        return Promise.reject(err);
    });  //要在这一层去return Promise.resolve和reject才有晓。
}



	var initiateChaincode = function(req, res, next) {
			var deployChaincodeId = req.params.deployChaincodeId;
			var req_param = req.params.param;
			var policy = req.params.policy;
        logger.debug("**************进入initiateChaincode");
        logger.debug("**************req.params:");
        logger.debug(req.params);
          initiateOrUpgradeChaincodeFunction(deployChaincodeId,req_param,policy,"init").then(function (data) {
              res.send(data);
          }).catch(function (err) {
              res.send(err);
          });

	};
	exports.initiateChaincode = initiateChaincode;
	
	
	var upgradeChaincode = function(req, res, next) {
			var deployChaincodeId = req.params.deployChaincodeId;
			var newChaincodeId = req.params.newChaincodeId;
            var newChaincodeVersion = req.params.newChaincodeVersion;
			var req_param = req.params.param;
            logger.debug("**************进入upgradeChaincode");
            logger.debug("**************req.params:");
            logger.debug(req.params);
            var sql="";
            var orgin_deploychaincode={};

            //第一步：先查出原记录的相关信息
            sql="select * from deploychaincode where pk_id="+deployChaincodeId;
             mysql.query(sql, [], function(err, result, field){
                    if(err==null){
                        logger.debug("**************升级智能合约--第一步：查出原记录的相关信息");
                        orgin_deploychaincode=result[0];
                        //第二步:更新deploychaincode表的fk_uploadchaincode_Id和version字段为用户选择的智能合约和输入的版本号，第二步才能正确安装新版本的智能合约
                        sql = "update deploychaincode set fk_uploadchaincode_Id = " + newChaincodeId + ",version='"+ newChaincodeVersion+"' where pk_id = " + deployChaincodeId ;
                        mysql.query(sql, [], function(err, result, field){
                               if(err==null){
                                   logger.debug("**************升级智能合约--第二步：更新deploychaincode表的fk_uploadchaincode_Id和version字段");
                                   //第三步：给实例下所有的peer安装新版本的智能合约
                                   installChaincodeFunction(deployChaincodeId,orgin_deploychaincode.installPeers).then(function (data) {
                                       logger.debug("**************升级智能合约--第三步：给实例下某个组织的peer安装新版本的智能合约");
                                       logger.debug("**************installChaincodeFunction执行完毕，data:");
                                       logger.debug(data);
                                       //第四步：调用balance-transfer后台的升级智能合约接口
                                       logger.debug("**************升级智能合约--第四步：调用balance-transfer后台的升级智能合约接口");
                                       initiateOrUpgradeChaincodeFunction(deployChaincodeId, req_param, "", "upgrade").then(function (data) {
                                           logger.debug("**************initiateOrUpgradeChaincodeFunction执行完毕，data:");
                                           logger.debug(data);
                                          return res.send(data);
                                       }).catch(function (err) {
                                           return res.send(err);
                                       });
                                   }).catch(function (err) {
                                       return res.send(err);
                                   });;
                               }else{
                                   return res.send(new RetMsg("500",err,null));
                               }
                        });
                    }else{
                        return res.send(new RetMsg("500",err,null));
                    }
             });
	};
	exports.upgradeChaincode = upgradeChaincode;

function RetMsg(code,msg,data) {
    this.code = code;
    this.msg = msg;
    this.data = data;
}