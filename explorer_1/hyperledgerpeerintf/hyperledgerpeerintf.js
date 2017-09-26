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
	var bearer = null;
	
	this.restCallBefore = function(callback) {
		
		request.post(hyperLedgerRESTEndpoint+"/users", 
			{
				"json": true,
				"body": {"username": config.username,"orgName": config.orgName}
			},
			function(error, response, body){
				console.log("error: " + error + " response: " + response + " body: " + body);
				bearer = "Bearer " + body.token;
				callback();
		});
		
	}
	
	this.restCallExecutor = function(uri,completion) {
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

	this.restCall = function(uri,completion) {
		
		var me = this;
		
		if(bearer == null) {
			this.restCallBefore(function(){
				me.restCallExecutor(uri,completion);	
			});
		} else {
			this.restCallExecutor(uri,completion);	
		}
	}
	
	this.restPostJsonCallExecutor = function(uri,form,completion) {
		var obj;
        let option = {
            url: hyperLedgerRESTEndpoint+uri,
            method: "POST",
            json: true,
            body: form,
			headers: {
				'authorization': bearer
			}
        };
        async.series( [
			function (callback) {
                console.log( ' Querying Hyperledger ' ,hyperLedgerRESTEndpoint+uri);
                request(option, function (error, response, body) {
                    console.log(body);
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
                        console.log("error = "+error);
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

    this.restPostJsonCall = function(uri,form,completion) {
		var me = this;
		
		if(bearer == null) {
			this.restCallBefore(function(){
				me.restPostJsonCallExecutor(uri,form,completion);	
			});
		} else {
			this.restPostJsonCallExecutor(uri,form,completion);	
		}
		
        

    }
}


HyperledgerPeerIntf.prototype.chain = function(channelName, callBk) {
	this.restCall('/channels/' + channelName+'?peer=peer1', callBk);
}

/*
HyperledgerPeerIntf.prototype.peers = function(callBk) {
	return;
    this.restCall('/network/peers',callBk);
}
*/

HyperledgerPeerIntf.prototype.block = function(channelName, blockNum, callBk) {
	this.restCall('/channels/' + channelName + '/blocks/' + blockNum, callBk);
}

HyperledgerPeerIntf.prototype.transactions = function(channelName,uuid,callBk) {
	this.restCall('/channels/'+channelName+'/transactions/'+uuid+"?peer=peer1",callBk);
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

HyperledgerPeerIntf.prototype.query = function(user,callBk) {
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
    this.restPostJsonCall('/chaincode/',param,callBk);
}

HyperledgerPeerIntf.prototype.createChannel = function(param, callBk) {
	this.restPostJsonCall('/channels/', param, callBk);
}

HyperledgerPeerIntf.prototype.joinChannel = function(param, callBk){
	this.restPostJsonCall('/channels/' + param.channelName + "/peers", param.peers, callBk);
}

HyperledgerPeerIntf.prototype.installPeer = function(param, callBk) {
	this.restPostJsonCall('/chaincodes/', param, callBk);
}

HyperledgerPeerIntf.prototype.instantiate = function(param, callBk) {
	this.restPostJsonCall('/channels/' + param.channelName +"/chaincodes", param.param, callBk);
}

module.exports = new HyperledgerPeerIntf();
