/**
 * Created by ucs_yangqihua on 2017/9/12.
 */

    var peerIntf = require('../../../hyperledgerpeerintf/hyperledgerpeerintf');
	var render = require( '../../../webcontent/dynamic/');
	var mysql = require('../../../hyperledgerpeerintf/mysqlUnit');


	
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
		try {
			var channelId = req.params.channelId;
			var chaincodeName = req.params.chaincodeName;
			var chaincodeVersion = req.params.chaincodeVersion;
            var uploadchaincode_Id = req.params.uploadchaincode_Id;

            var data = {chaincodename:chaincodeName,version:chaincodeVersion,channelId:channelId,fk_uploadchaincode_Id:uploadchaincode_Id};
			var sql = "insert into deploychaincode set ?";
			mysql.query(sql, data, function(err, result, field){

				res.send(new RetMsg("200","操作成功",null));
			});
		} catch(e) {			
			console.log("error newDeployChaincode: " + e);
			res.send(new RetMsg("100","操作失败",null));
		}
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
			var sql = "select count(*) as count, a.pk_id,a.installPeers,a.Status, a.ChaincodeName, a.version, b.channelName, a.Params ,c.Name as uploadchaincodeName\
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
	
	var installChaincode = function(req, res, next) {
		try {
			var deployChaincodeId = req.params.deployChaincodeId;
			var peerId = req.params.peerId;
			var peerIdArray = peerId.split(",");
			var peerIdStr = "";
			for(var i = 0; i < peerIdArray.length; i++) {
				if(i != 0){
					peerIdStr += ",";
				}
				peerIdStr += peerIdArray[i];
			}
            mysql.query("select * from deploychaincode where pk_id = "+deployChaincodeId, [], function(err, result, field){
            	if(result.length ==0){
                    res.send(new RetMsg(100,"操作失败，此智能合约不存在",null));
                    return;
				}else {

            		//多次安装，需保存之前的installPeers
            		var status =1;
            		if(result[0].installPeers !=''){
                        result[0].installPeers =result[0].installPeers+",";
					}
                    var sql = "update deploychaincode set installPeers = '" +result[0].installPeers+ peerIdStr + "' ,Status = "+status+" where pk_id = '" + deployChaincodeId + "'";
                    mysql.query(sql, [], function(err, result, field){
                        sql = "select a.chaincodename, b.MainPath, a.version, group_concat(c.PeerId) as peerid\
							from deploychaincode a\
							left join uploadchaincode b\
							left join peernode c\
							on 1 = 1\
							and c.pk_Id in (" + peerIdStr + ")\
							on a.fk_uploadchaincode_Id = b.pk_Id\
							where a.pk_id = " + deployChaincodeId;
                        mysql.query(sql, [], function(err, result, field){
                            //调用远程接口，安装peer
                            var param = {
                                "peers": result[0].peerid.split(","),
                                "chaincodeName": result[0].chaincodename,
                                "chaincodePath": result[0].MainPath,
                                "chaincodeVersion": result[0].version
                            };
                            peerIntf.installPeer(param, function(){
                                res.send(new RetMsg("200","操作成功",""));
                            });
                        });
                    });
				}

            });

		} catch(e) {			
			console.log("error installChaincode: " + e);
			res.send(new RetMsg(100,"操作失败",null));
		}
	};
	exports.installChaincode = installChaincode;
	
	
	var initiateChaincode = function(req, res, next) {
		try {
			var deployChaincodeId = req.params.deployChaincodeId;
			var param = req.params.param;
			var policy = req.params.policy;
			var sql = "update deploychaincode set Status =2, params = '" + param + "', endorsePolicy = '" + policy + "' where pk_id = '" + deployChaincodeId + "'";
			mysql.query(sql, [], function(err, result, field){
				sql = "select b.channelName, a.ChaincodeName, a.version, a.Params\
						from deploychaincode a\
						left join channel b\
						on b.pk_Id = a.channelId\
						where a.pk_id = " + deployChaincodeId;
				mysql.query(sql, [], function(err, result, field){
					var param = {
						"channelName": result[0].channelName,
						"param": {
							"chaincodeName": result[0].ChaincodeName,
							"chaincodeVersion": result[0].version,
							"args": result[0].Params
						}
					};
					peerIntf.instantiate(param, function(){
						res.send(new RetMsg("200","操作成功",null));	
					});
					
				});
			});
		} catch(e) {			
			console.log("error initiateChaincode: " + e);
            res.send(new RetMsg("100","操作失败",null));
		}
	};
	exports.initiateChaincode = initiateChaincode;
	
	
	var upgradeChaincode = function(req, res, next) {
		try {
			var deployChaincodeId = req.params.deployChaincodeId;
			var newChaincodeId = req.params.newChaincodeId;
			var param = req.params.param;
			
			var sql = "update deploychaincode set fk_uploadchaincode_Id = '" + newChaincodeId + "', params = '" + param + "' where pk_id = '" + deployChaincodeId + "'";
			mysql.query(sql, [], function(err, result, field){
                res.send(new RetMsg("200","操作成功",null));
			});
		} catch(e) {			
			console.log("error upgradeChaincode: " + e);
            res.send(new RetMsg("100","操作失败",null));
		}
	};
	exports.upgradeChaincode = upgradeChaincode;

function RetMsg(code,msg,data) {
    this.code = code;
    this.msg = msg;
    this.data = data;
}