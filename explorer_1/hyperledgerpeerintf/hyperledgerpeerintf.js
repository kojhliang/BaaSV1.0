/*Copyright DTCC 2016 All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
	
	http://www.apache.org/licenses/LICENSE-2.0
	
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/

var server = require('../exp-server');
var mysql = require('./mysqlUnit');
var config = require('../config.default');
var HyperledgerPeerIntf = function() {
	var hyperLedgerRESTEndpoint = config.HYP_REST_ENDPOINT || "http://127.0.0.1:7050";
	 hyperLedgerRESTEndpoint = process.argv[2] ||hyperLedgerRESTEndpoint|| "http://127.0.0.1:7050";
	 console.log("hyperLedgerRESTEndpoint"+hyperLedgerRESTEndpoint);
	var async = require('async');
	var request = require('request');
	//var bearer = null;
	/*
	this.restCallBefore = function(callback,orgName) {
		
		request.post(hyperLedgerRESTEndpoint+"/users", 
			{
				"json": true,
				"body": {"username": config.username,"orgName": orgName}
			},
			function(error, response, body){
				console.log("error: " + error + " response: " + response + " body: " + body);
				bearer = "Bearer " + body.token;
				callback();
		});
		
	}*/
	
	this.restCallExecutor = function(bearer,uri,completion) {
		var obj;
		async.series( [function (callback) {
			
			var optitons = {
				url : global.hy_endpoint+uri,
				headers: {
					'authorization': bearer
				}
				
			};
			
			request(optitons, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					if(body == null) {
						callback(null,null);
					} else if(body.indexOf("status: 500") > 0) {
						callback(null,null);
					} else {
						obj = JSON.parse(body)
						callback(null,obj);
					}
				} else {
					console.log("hyperLedgerRESTEndpoint connect failed,change another");
					server.changeURL();
					console.log(error);
					callback(error);
					//throw error;
				}
				
			});
			
		},
		function(callback) {
			   completion(obj);
			   callback();
		 }
		]);
		
	}

	this.restCall = function(uri,completion,orgName) {
		
		var me = this;
		/*
		if(bearer == null) {
			this.restCallBefore(function(){
				me.restCallExecutor(uri,completion);
			},orgName);
		} else {
			this.restCallExecutor(uri,completion);
		}*/
		var bearer="";
        request.post(hyperLedgerRESTEndpoint+"/users",
            {
                "json": true,
                "body": {"username": config.username,"orgName": orgName}
            },
            function(error, response, body){
                console.log("error: " + error  );
               // console.log(response);
                console.log("body: ");
                console.log(body);
                bearer = "Bearer " + body.token;
                me.restCallExecutor(bearer,uri,completion);
                //callback();
            });

	}
	
	this.restPostJsonCallExecutor = function(bearer,uri,form,completion) {
		var obj;
        let option = {
            url: hyperLedgerRESTEndpoint+uri,
            method: "POST",
            json: true,
            body: form,
			headers: {
				'authorization': bearer
			},
            timeout:300000
        };
        async.series( [
			function (callback) {
                console.log( ' Querying Hyperledger ' ,hyperLedgerRESTEndpoint+uri);
                request(option, function (error, response, body) {
                    console.log("error = "+error);
                    console.log("body = "+body);
                    if (!error && response.statusCode == 200) {
                        if(body == null)
                            callback(null,null);
                        else {
                            var o =JSON.stringify(body);

                            obj = JSON.parse(o);
                            callback(null,obj);
                        }
                    } else {
                        console.log("hyperLedgerRESTEndpoint connect failed,change another");
                        server.changeURL();

                        callback(error);
                        //throw error;
                    }

                })
            },
			function(callback) {
			   // console.log( ' resp ' , obj);
				completion(obj);
				callback();
			}]
        );
	}

    this.restPostJsonCall = function(uri,form,completion,orgName) {
		var me = this;
		/*
		if(bearer == null) {
			this.restCallBefore(function(){
				me.restPostJsonCallExecutor(uri,form,completion);
			},orgName);
		} else {
			this.restPostJsonCallExecutor(uri,form,completion);
		}*/
        var bearer="";
        request.post(hyperLedgerRESTEndpoint+"/users",
            {
                "json": true,
                "body": {"username": config.username,"orgName": orgName}
            },
            function(error, response, body){
               if(error==null){
                   console.log("error: " + error  );
                   //console.log(response);
                   console.log("body: ");
                   console.log(body);
                   bearer = "Bearer " + body.token;
                   me.restPostJsonCallExecutor(bearer,uri,form,completion);
                   //callback();
               }
               else{
                   console.log("****获取token出错！");
               }

            });
    }
}


//查找加入某个管道的第一个组织的sql
find_org_sql="select a.channelId as channelId,c.pk_Id as orgId,c.orgName as orgName from channel_org a,channel b,org c where a.channelId=b.pk_Id and a.orgId=c.pk_Id and b.isOk=1 and b.channelName=? order by c.pk_Id asc";

HyperledgerPeerIntf.prototype.chain = function(channelName, callBk) {
    var me=this;
    var orgName="";
    var channelId="";
    var orgId="";
    //console.log("****************777777channelName : "+channelName);
    mysql.query(find_org_sql,channelName,function(err,results,fields) {
        //console.log("**************777777results : ");
        //console.log(results);
        if (results != null && results.length!=0) {
            orgName= results[0].orgName;
            channelId=results[0].channelId;
            orgId=results[0].orgId;
            mysql.query("select b.PeerId as peerId from channel_peernode a,peernode b where a.peernodeID=b.pk_Id and b.fk_org_Id="+orgId+" and a.channelId="+channelId,"",function(err,results,fields) {
                me.restCall('/channels/' + channelName + '?peer='+results[0].peerId, callBk, orgName);
            });
        }
    });
}

/*
HyperledgerPeerIntf.prototype.peers = function(callBk) {
	return;
    this.restCall('/network/peers',callBk);
}
*/

HyperledgerPeerIntf.prototype.block = function(channelName, blockNum, callBk) {
    var me=this;
    mysql.query(find_org_sql,channelName,function(err,results,fields) {
        if (results != null) {
            me.restCall('/channels/' + channelName + '/blocks/' + blockNum, callBk, results[0].orgName);
        }
    });
}

HyperledgerPeerIntf.prototype.transactions = function(channelName,uuid,callBk) {
    var me=this;
    mysql.query(find_org_sql,channelName,function(err,results,fields){
    	if(results!=null){
            me.restCall('/channels/'+channelName+'/transactions/'+uuid+"?peer=peer1",callBk,results[0].orgName);
        }
    });
}

/*
HyperledgerPeerIntf.prototype.register = function(callBk) {
    let param = {'enrollId': 'jim','enrollSecret': '6avZQLwcUe9b'};
    this.restPostJsonCall('/registrar/',param,callBk);
}
*/

HyperledgerPeerIntf.prototype.deploy = function(args,path,callBk) {

    // var data = {name:user1,description:user1money};
    //
    // var id;
    // mysql.query("insert into upload set ?",data,function(err,results,fields){
    //     //do something
    //     console.log("err = "+err);
    //     console.log("results.insertId =  = "+results.insertId);
    //     id=results.insertId;
    //     console.log("fields = "+fields);
    //
    //     var updateData =['a', 'b', 'c',id];
    //     mysql.query("update upload set name =?,description =?,path =? where id=?",updateData,function(err,results,fields){
    //         //do something
    //         console.log("err = "+err);
    //         console.log("results = "+results);
    //         console.log("fields = "+fields);
    //
    //     });
    //
    // });




    // mysql.query("delete from upload where id=1","",function(err,results,fields){
    //     //do something
    //     console.log("err = "+err);
    //
    //     console.log("fields = "+fields);
    //
    // });


    var username = server.getLoginUser();
    let param ={
        "jsonrpc": "2.0",
        "method": "deploy",
        "params": {
            "type": 1,
            "chaincodeID":{
                "path":path
            },
            "ctorMsg": {
                "function":"init",
                "args":args
            },
            "secureContext": username
        },
        "id": 1
    };
    console.log(JSON.stringify(param));
    this.restPostJsonCall('/chaincode/',param,callBk);
}

HyperledgerPeerIntf.prototype.invoke = function(money,callBk) {
    var username = server.getLoginUser();
    let param ={
        "jsonrpc": "2.0",
        "method": "invoke",
        "params": {
            "type": 1,
            "chaincodeID":{
                "name":"mycc"
            },
            "ctorMsg": {
                "function":"invoke",
                "args":["a", "b", money]
            },
            "secureContext": username
        },
        "id": 3
    };
    this.restPostJsonCall('/chaincode/',param,callBk);
}

HyperledgerPeerIntf.prototype.query = function(user,callBk,orgName) {
    var username = server.getLoginUser();
    console.log("query "+user);
    let param ={
        "jsonrpc": "2.0",
        "method": "query",
        "params": {
            "type": 1,
            "chaincodeID":{
                "name":"mycc"
            }, "ctorMsg": {
                "function":"query",
                "args":[user]
            },
            "secureContext": username
        },
        "id": 5
    };
    this.restPostJsonCall('/chaincode/',param,callBk,orgName);
}

HyperledgerPeerIntf.prototype.createChannel = function(param, callBk,orgName) {
	this.restPostJsonCall('/channels/', param, callBk,orgName);
}

HyperledgerPeerIntf.prototype.joinChannel = function(param, callBk,orgName){
	this.restPostJsonCall('/channels/' + param.channelName + "/peers", param.peers, callBk,orgName);
}

HyperledgerPeerIntf.prototype.installPeer = function(param, callBk,orgName) {
	this.restPostJsonCall('/chaincodes/', param, callBk,orgName);
}

HyperledgerPeerIntf.prototype.instantiate = function(param, callBk,orgName) {
	this.restPostJsonCall('/channels/' + param.channelName +"/chaincodes", param.param, callBk,orgName);
}

HyperledgerPeerIntf.prototype.upgrade = function(param, callBk,orgName) {
    this.restPostJsonCall('/channels/' + param.channelName +"/upgrade/chaincodes", param.param, callBk,orgName);
}

HyperledgerPeerIntf.prototype.queryChainByPeer = function(param, callBk,orgName) {
    this.restCall('/channels/?peer=' + param.peerName , callBk,orgName);
}

module.exports = new HyperledgerPeerIntf();
