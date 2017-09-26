   /**
 * Created by ucs_yangqihua on 2017/9/12.
 */
    var peerIntf = require('../../../hyperledgerpeerintf/hyperledgerpeerintf');
	var render = require( '../../../webcontent/dynamic/');
	var mysql = require('../../../hyperledgerpeerintf/mysqlUnit');
    var Docker = require('dockerode');
    var async = require('async');
    var test1 = function (req, res, next) {
        res.send({success: true, params1: req.body.query,params2:req.query.params2});
    };
    exports.test1 = test1;
    var test2 = function (req, res, next) {
        res.send({success: true, params1: req.params.params1,params2:req.query.params2});
    };
    exports.test2 = test2;
    var test3 = function (req, res, next) {
        res.send({success: true, params1: req.body.params1,params2:req.body.params2});
    };
    exports.test3 = test3;
    var test4 = function (req, res, next) {
        res.send({success: true, params1: req.params.params1,params2:req.body.params2});
    };
    exports.test4 = test4;
	
	
	/*
	查询block
	*/
	var getBlockByChannelNameAndBlockNum = function (req, res, next) {
		try {
			var blockNum =  req.params.blockNum;
			var channelName = req.params.channelName;
			peerIntf.block(channelName, blockNum, function (obj) {
				res.send(obj);
			});
		} catch(e) {
			console.log("error getBlockByChannelNameAndBlockNum: " + e);
			res.send({});
		}
	};
	exports.getBlockByChannelNameAndBlockNum = getBlockByChannelNameAndBlockNum;
	/*
	查询peer
	*/
	var getPeer = function (req, res, next) {
		try {
			var sql = "select a.pk_Id, a.PeerName,a.Online, a.Ip, b.orgName, ifnull(channelCount, 0) as count\
						from peernode a\
						inner join org b\
						on b.pk_Id = a.fk_org_Id\
						left join (\
						select a.pk_id, count(1) as channelCount\
						from peernode a\
						inner join \
						channel_peernode b\
						on a.pk_Id = b.peernodeID\
						group by a.pk_id\
						) c\
						on a.pk_Id = c.pk_id";
			mysql.query(sql,[],function(err,result,field){
                // getDockerState(result,function (obj) {
                //     res.send(obj);
                // });
				//console.log(result[0]);
                // var readFileAsync = Promise.promisify(getDockerState);
                // readFileAsync(result)
                //     .then(function(data){
                //         console.log("here");
                //         res.send(data);
                //     }).catch(function(err){
                //     console.log("err = "+err);
                // });
			//	getDockerState(result);
                res.send(result);
			});
			
		} catch(e) {
			console.log("error getPeer: " + e);
			/*res.send(render.network(0));*/
			res.send({});
		}
	};
	exports.getPeer = getPeer;
	var getDockerState =function (peers) {
		peers.forEach(function (peer) {
            async.series([
                function(cb) {
                    console.log(peer.Ip);
                    var docker = new Docker({host: 'http://' + peer.Ip, port: 2375});
                    if (docker == null) {
                        console.log("docker is null " + ip);
                        return;
                    }
                    docker.listContainers(function (err, containers) {
                        containers.forEach(function (containerInfo) {
                            console.log("Names = " + containerInfo.Names[0]);
                            if (containerInfo.Names[0].replace("_", "").replace("/", "") == peer.PeerName) {
                                console.log(containerInfo.State);
                                peer["online"] = containerInfo.State;
                            }
                        });
                    });
                    console.log("end each");
                }
            ], function(err, results) {
                log('1.1 err: ', err);
                log('1.1 results: ', results);
            });
        });
        console.log("end for");
        // console.log(peers);
        // for (var peer in peers) {
        // 	console.log("peer.Ip = "+peers[peer].Ip);
        //     var docker = new Docker({host: 'http://' + peers[peer].Ip, port: 2375});
        //     if (docker == null) {
        //         console.log("docker is null " + ip);
        //         return;
        //     }
        //
        //             docker.listContainers(function (err, containers) {
        //                 containers.forEach(function (containerInfo) {
        //                     console.log("Names = " + containerInfo.Names[0]);
        //
        //                     if (containerInfo.Names[0].replace("_", "").replace("/", "") == peers[peer].PeerName) {
        //                         console.log(containerInfo.State);
        //                         peers[peer]["online"] = containerInfo.State;
        //                     }
        //                 });
        //             });
        //
        //
        //     console.log("end each");
        // }
        // console.log("end for");
        // return peers;
    };
    // function ll(docker) {
    //     docker.listContainers(function (err, containers) {
    //         containers.forEach(function (containerInfo) {
    //             console.log("Names = " + containerInfo.Names[0]);
    //
    //             // if (containerInfo.Names[0].replace("_", "").replace("/", "") ==  peers[peer].PeerName) {
    //             console.log(containerInfo.State);
    //             //  peers[peer]["online"]=containerInfo.State;
    //             // }
    //         });
    //     });
    // }
	
	/*
	
	*/
	var getChannelByName = function(req, res, next) {
		try{
			var channelName = req.params.channelName;
			peerIntf.chain(channelName, function(obj){
				res.send(obj);
			});
		} catch(e) {
			console.log("error getChannelByName: " + e);
			res.send({});
		}
	};
	exports.getChannelByName = getChannelByName;
	
	
	var getChannelByPeerId = function(req, res, next) {
		try {
			var peerId = req.params.peerId;
			var sql = "select b.channelName \
						from channel_peernode a \
						inner join channel b \
						on b.pk_id = a.channelId \
						where peernodeID =" + peerId;
			mysql.query(sql, [], function(err, result, field){
				res.send(result);
			});
		} catch(e) {
			console.log("error getChannelsByPeerId: " + e);
			res.send({});
		}
	};
	exports.getChannelByPeerId = getChannelByPeerId;
	
	var getChannelName = function(req, res, next) {
		try {
			//select pk_Id, channelName from channel
			var sql = "select pk_Id, channelName from channel";
			mysql.query(sql, [], function(err, result, field){
				res.send(result);
			});
		} catch(e) {
			console.log("error getChannelName: " + e);
			res.send({});
		}
	};
	exports.getChannelName = getChannelName;
	
	var peerStart = function(req, res, next) {
		try{
			var peerId = req.params.peerId;
			var sql = "select * from peernode where pk_id = " + peerId;
			mysql.query(sql, [], function(err, result, field){
				if(result && result[0]){
					var docker = new Docker({host: "http://" + result[0].Ip, port: 2375});
					if(docker){
						var container = docker.getContainer(result[0].ContainerId);
						container.start(function(err, data){
							if(err) {
								console.log(err);
							}
							res.send({});
						});
					}
				}
			});
		}catch(e){
			console.log("error peerStart: " + e);
			res.send({});
		}
	};
	exports.peerStart = peerStart;
	
	
	var peerStop = function(req, res, next) {
		try{
			var peerId = req.params.peerId;
			var sql = "select * from peernode where pk_id = " + peerId;
			mysql.query(sql, [], function(err, result, field){
				if(result && result[0]){
					var docker = new Docker({host: "http://" + result[0].Ip, port: 2375});
					if(docker){
						var container = docker.getContainer(result[0].ContainerId);
						container.stop(function(err, data){
							if(err) {
								console.log(err);
							}
							res.send({});
						});
					}
				}
			});
		}catch(e){
			console.log("error peerStop: " + e);
			res.send({});
		}
	};
	exports.peerStop = peerStop;
	
	