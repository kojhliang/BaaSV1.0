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
//"use strict";
// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = process.env.PROC_NAME || 'HyperlegerExplorer';
var apiRouterV1 = require('./api_router_v1');
var cors = require('cors');
var config = require('./config.default');
console.log("!!"+config.host);
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
app.use(express.static(__dirname+'/webcontent/static/scripts'));
app.use(express.static(__dirname+'/webcontent/static/css'));
app.use(express.static(__dirname+'/webcontent/static/images'));
app.use(express.static(__dirname+'/webcontent/static/scripts/socket.io-client'));
app.use(express.static(__dirname+'/webcontent/static/scripts/angular'));
app.use(express.static(__dirname+'/webcontent/static/scripts/angular-animate'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
// routes
app.use('/api/v1', cors(), apiRouterV1);
var peer_num = process.argv[4]||process.env.PEER_NUM || 4;
var hyperLedgerRESTEndpoint = config.HYP_REST_ENDPOINT || "http://127.0.0.1:4000";
global.hy_endpoint  = process.argv[2] ||hyperLedgerRESTEndpoint|| "http://127.0.0.1:4000";
//dockerģ�� start
var Docker = require('dockerode');
var stream = require('stream');
//dockerģ�� end
//�ϴ�ģ�� start
var multer  = require('multer');
var fs = require('fs'),unzip = require('unzip');
//�ļ��ϴ�·��
var uploadFolder =config.uploadFolder;
//var uploadFolder = '/opt/fabric-0.6/upload';
//�ļ���ѹ·��
var zipFolder = config.zipFolder;
var deployFolder = config.deployFolder;
//var zipFolder = "/opt/fabric-0.6/unzip";
//go�ļ����Ա���·��
var goBuildFolder =config.goBuildFolder;
//var goBuildFolder ="/opt/fabric-0.6/upload/goBuild";
var gopath = config.gopath;
var user_chaincode_Path =config.user_chaincode_Path;
var createFolder = function(folder){
    try{
        fs.accessSync(folder);
    }catch(e){
        fs.mkdirSync(folder);
    }
};
//�ļ���ѹ start
var decompress = require('decompress');
var f_path = require("path");
//�ļ���ѹ end
//�ļ����� start
var walk = require('walk');
//�ļ����� end
var exec = require('child_process').exec;
var request = require('request');
//�ļ�ɨ�裬�����⣬�������ݿ�
function getFileList(path,targetFile,unzip_timestamp,req,res){
    var walker  = walk.walk(path, { followLinks: false });
    var files = [],dirs = [];
	var count =0;
	var targetParentPath ="";
	var result ="";
    walker.on('file', function(roots, stat, next) {
        console.log("stat.name ="+stat.name);
        files.push(roots + '/' + stat.name);
        if(stat.name ==targetFile){
            console.log("get main.go");
            count ++;
            targetParentPath =roots;
		}
        next();
    });
    walker.on('directory', function(roots, stat, next) {
        dirs.push(roots + '/' + stat.name);
        next();
    });
    walker.on('end', function() {
        console.log("files "+files);
        console.log("dirs "+dirs);
        if(count ==0){
            //ɾ���ļ���
            deleteFile(path);
            res.send(new RetMsg("100","���ϴ�main.go �ļ�",""));
            return;
		}
		if(count>1){
            //ɾ���ļ���
            deleteFile(path);
            res.send(new RetMsg("100","ֻ���ϴ�һ��main.go �ļ�",""));
            return;
		}
        if(count ==1){
            //�������ܺ�Լ
            exec('cp -r '+path+'/* '+user_chaincode_Path,function(err,out) {
                console.log(out); err && console.log(err);
                //�Ƚ��д�����
                var timestamp =getTimeStamp();
                var tempCheckPath =targetParentPath.replace(zipFolder.replace("//","\\"),"");
                tempCheckPath = tempCheckPath.replace("/"+unzip_timestamp,"");
                console.log(tempCheckPath);
                var commond ='';
                if(config.debug ){
                    commond ='go build -o '+goBuildFolder+'/'+timestamp+' '+path+'/main.go';
                }else {
                    commond ='export GOPATH='+gopath+';go build -o '+goBuildFolder+'/'+timestamp+' '+user_chaincode_Path+tempCheckPath+'/main.go';
                }
                exec(commond , function(err, stdout, stderr) {
                    if (err){
                        console.log("err = "+err);
                        //ɾ���ļ���
                        deleteFile(path);
                        res.send(new RetMsg("100","main.go�﷨����"+err,""));
                        return;
                    }else {
                        //ɾ���ձ�����ļ�
                        fs.unlinkSync(goBuildFolder+'//'+timestamp);
                        //�������ݵ����ݿ�
                        targetParentPath =targetParentPath.replace(zipFolder.replace("//","\\"),"user_chaincode");
                        targetParentPath = targetParentPath.replace("/"+unzip_timestamp,"");
                        var data = {Name:req.body.name,Description:req.body.description,MainPath:targetParentPath,UploadPath:path,ChaincodeType:"userUpload"};
                        mysql.query("insert into uploadchaincode set ?",data,function(err,results,fields){
                            //do something
                            console.log("err = "+err);
                            console.log("results.insertId =  = "+results.insertId);
                            console.log("fields = "+fields);
                            res.send(new RetMsg("200","�ϴ��ɹ�",""));
                        });
                    }
                });
            });
        }else {
            res.send(new RetMsg("100","�ϴ�����",""));
		}
    });
}
function deleteFile(path) {
    exec('rm -rf '+path,function(err,out) {
        console.log(out); err && console.log(err);
    });
}
createFolder(uploadFolder);
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);    // �����·������ע����Ҫ�Լ�����
    },
    filename: function (req, file, cb) {
        // �������ļ�������Ϊ �ֶ��� + ʱ��������� logo-1478521468943
        cb(null, file.originalname);
    }
});
var upload = multer({ storage: storage });
//�ϴ�ģ�� end
var sleep = require('thread-sleep');
var peerIntf = require('./hyperledgerpeerintf');
//mysqlģ��
var mysql = require('./hyperledgerpeerintf/mysqlUnit');
function rnd(n, m){
    var random = Math.floor(Math.random()*(m-n+1)+n);
    return random;
}
 var changeURL = function() {
	 if(ledgerData.peers.peers!=null)
	 {
 	  // for(var i=0;i<ledgerData.peers.peers.length;i++){
 		// var ip =global.hy_endpoint.toString().split(":")[1].split("//")[1];
 		// if(ledgerData.peers.peers[i].address.indexOf(ip) <= -1){
 		//     var ran_num = rnd(0,ledgerData.peers.peers.length);
        //     global.hy_endpoint = "http://"+ledgerData.peers.peers[i].address.toString().split(":")[0]+":7050";
 		// 	break;
 		// }
 	  //  }
         var ip =global.hy_endpoint.toString().split(":")[1].split("//")[1];
 	   for(var i=0;i<i+1;i++){
 	      //���ֻ��1���ڵ㣬���޷�ѡ��
 	      if(ledgerData.peers.peers.length ==1){
              global.hy_endpoint = "http://"+ledgerData.peers.peers[0].address.toString().split(":")[0]+":7050";
              break;
          }
           var ran_num = rnd(0,ledgerData.peers.peers.length-1);
           if(ledgerData.peers.peers[ran_num].address.indexOf(ip) <= -1){
               global.hy_endpoint = "http://"+ledgerData.peers.peers[ran_num].address.toString().split(":")[0]+":7050";
               console.log(" change hy_endpoint = "+global.hy_endpoint);
               break;
           }
           //��ֹһֱѭ��
           if(i>20){
               console.log(" change hy_endpoint more than 20 times  = "+global.hy_endpoint);
               break;
           }
       }
	}
 }
module.exports.changeURL = changeURL;
 var getLoginUser =  function() {
 	var userName = '';
     if(ledgerData.peers.peers!=null)
     {
         for(var i=0;i<ledgerData.peers.peers.length;i++){
             var ip =global.hy_endpoint.toString().split(":")[1].split("//")[1];
             if(ledgerData.peers.peers[i].address.indexOf(ip) > -1){
             	var vpName =  ledgerData.peers.peers[i].ID.name;
                 userName ="user"+vpName.substring(2,vpName.length);
                 break;
             }
         }
         console.log(" userName = "+userName);
     }
     return userName;
 }
module.exports.getLoginUser = getLoginUser;
//var dots = require("dot").process({ path: "./views"});
require("dot").process({
	templateSettings : {
	  evaluate:    /\(\(([\s\S]+?)\)\)/g,
	  interpolate: /\(\(=([\s\S]+?)\)\)/g,
	  encode:      /\(\(!([\s\S]+?)\)\)/g,
	  use:         /\(\(#([\s\S]+?)\)\)/g,
	  define:      /\(\(##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\)\)/g,
	  conditional: /\(\(\?(\?)?\s*([\s\S]*?)\s*\)\)/g,
	  iterate:     /\(\(~\s*(?:\)\)|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\)\))/g,
	  varname: 'it',
	  strip: true,
	  append: true,
	  selfcontained: false
	}
	,global: "_page.render"
	, destination: __dirname + "/webcontent/dynamic/"
	, path: (__dirname + "/templates")
});
var render = require( __dirname + "/webcontent/dynamic/");
//Hyperledger UI
ledgerData = {"peer_num":peer_num ,"chain" : { "height" : {"low" : 0},"currentBlockHash":{"buffer":{"type":"Buffer","data":""}}}, "total_peers" : [] , "peers" : {} , "blocks" : []};
statsData = null
app.get("/", function(req, res) {
	try {
		res.send(render.main());
	} catch(e) {
		console.log(" ��������ʧ�� "+e);
		return res.send(render.main(0));
	}
});
// ��¼
app.get("/login", function(req, res) {
	try {
		res.send(render.login());
	} catch(e) {
		console.log(" �򿪽���ʧ�� "+e);
		return res.send(render.main(0));
	}
});
// ��Լ����
app.get("/chaincodeManager", function(req, res) {
	try {
		res.send(render.chaincodeManager());
	} catch(e) {
		console.log(" �򿪽���ʧ�� "+e);
		return res.send(render.main(0));
	}
});
// ʵ������
app.get("/instanceManager", function(req, res) {
	try {
		res.send(render.instanceManager());
	} catch(e) {
		console.log(" �򿪽���ʧ�� "+e);
		return res.send(render.main(0));
	}
});
//�ļ��ϴ�
app.post('/singleUpload', upload.single('file'), function (req, res, next) {
    // req.file is the `avatar` file
    // req.body will hold the text fields, if there were any
    console.log(req.file.path);//�ϴ��ļ�����·��
    console.log(req.body);
	var filePath = req.file.path;
    // if(filePath.indexOf(".zip") <= -1){
    //     res.send(new RetMsg("100","���ϴ�zip�ļ�",""));
    //     return;
    // }
    var temp =filePath.split(".");
    var fileType =temp[temp.length-1];
    var timestamp = getTimeStamp();
    //�����ļ���
	var zipPath = zipFolder+"//"+timestamp;
	console.log("zipPath = "+zipPath);
    createFolder(zipPath);
    if(fileType !="go"&&fileType !="gz"&&fileType !="zip"&&fileType !="tar"){
            res.send(new RetMsg("100","�����ϴ����ļ���ʽ",""));
            return;
    }
    if(fileType =="go"){
        fs.writeFileSync(zipPath+"//main.go", fs.readFileSync(filePath));
    }
    //����ǰ�����goPath
    deleteFile(user_chaincode_Path+"/*");
    decompress(filePath, zipPath).then(files => {
    var root = f_path.join(zipPath);
    //��ȡmain.go������������ڣ�����Ϣ�������ݿ�
    getFileList(root,"main.go",timestamp,req,res);
});
});
//ɾ���ϴ��ļ���
app.get("/deleteFile", function(req, res) {
    mysql.query("select * from uploadchaincode where pk_Id=?",[req.query.id],function(err,results,fields){
    	if(results.length == 1){
    		if(results[0].ChaincodeType !="userUpload"){
                return res.send("����ɾ���û��ϴ������ܺ�Լ");
			}
            exec('rm -rf '+results[0].UploadPath,function(err,out) {
            	if(err){
                    console.log(err);
                    return res.send("ɾ��ʧ��");
				}else {
                    mysql.query("delete from uploadchaincode where pk_Id=?",[req.query.id],function(err,results,fields){});
                    return res.send("ɾ���ɹ�");
				}
            });
		}
    })
});
function getTimeStamp() {
    var timestamp = Date.parse(new Date());
    timestamp = timestamp / 1000;
    return timestamp;
}
//view ����
app.get("/networkpeer", function(req, res) {
    try {
        var ledgerDataStr = JSON.stringify(ledgerData);
        var statsDataStr = JSON.stringify(statsData);
        console.log("�������network peers:"+printArray(ledgerData.peers.peers));
        res.send(render.network({'ledgerData' : ledgerDataStr , 'statsData':statsDataStr}));
    } catch(e) {
        console.log(" Error retrieving initial hyperledger info "+e);
        return res.send(render.network(0));
    }
});
app.get("/HyperlegerExplorer", function(req, res) {
	try {
		var ledgerDataStr = JSON.stringify(ledgerData);
		var statsDataStr = JSON.stringify(statsData);
		res.send(render.HyperlegerExplorer({'ledgerData' : ledgerDataStr , 'statsData':statsDataStr}));
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.HyperlegerExplorer(0));
	}
});
app.get("/getledgerData", function(req, res) {
    //  var total_peers = JSON.stringify(ledgerData.total_peers);
    res.send({"ledgerData":ledgerData.total_peers});
});
app.get("/getPeerStatus", function(req, res) {
    //var peerName = req.query.peerName;
    console.log("getPeerStatus");
    if(req.query.peerName ==undefined ||req.query.peerName ==''){
        res.send(new RetMsg("100","��������",""));
    }
    mysql.query("select * from peernode where PeerName=?",req.query.peerName,function(err,results,fields){
        if(results.length !=0){
            // getDockerStatus(results,function (obj) {
            //     res.send(new RetMsg("200","success",obj));
            // })
            res.send(new RetMsg("200","success",results));
        }
    });
});
function getDockerStatus(peerInfo,callback) {
    console.log(peerInfo);
    var docker = new Docker({host: 'http://'+peerInfo[0].Ip, port: 2375});
    if(docker ==null){
        console.log("docker is null "+peerInfo[0].Ip);
        return;
    }
    docker.listContainers(function (err, containers) {
        containers.forEach(function (containerInfo) {
            //console.log(containerInfo);
            if(containerInfo.Names[0].replace("_","").replace("/","") == peerInfo[0].peerName){
                if(containerInfo.State =="running"){
                    callback(true);
                  //  res.send(new RetMsg("200","success",true));
                }else {
                    //res.send(new RetMsg("200","success",false));
                    callback(false);
                }
            }
        });
    });
    callback(false);
}
app.get("/blockquery", function(req, res) {
	try {
		var ledgerDataStr = JSON.stringify(ledgerData);
		var statsDataStr = JSON.stringify(statsData);
		res.send(render.blockquery({'ledgerData' : ledgerDataStr , 'statsData':statsDataStr}));
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.blockquery(0));
	}
});
app.get("/statisgraph", function(req, res) {
	try {
		var ledgerDataStr = JSON.stringify(ledgerData);
		var statsDataStr = JSON.stringify(statsData);
		res.send(render.statisticsCharts({'ledgerData' : ledgerDataStr , 'statsData':statsDataStr}));
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.statisticsCharts(0));
	}
});
app.get("/transactionquery", function(req, res) {
	try {
		var ledgerDataStr = JSON.stringify(ledgerData);
		var statsDataStr = JSON.stringify(statsData);
		res.send(render.transactions({'ledgerData' : ledgerDataStr , 'statsData':statsDataStr}));
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.transactions(0));
	}
});
app.get("/chaincodeDeploy", function(req, res) {
	try {
		res.send(render.chaincodeDeploy());
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.chaincodeDeploy(0));
	}
});
app.get("/chaincodeExecute", function(req, res) {
	try {
		res.send(render.chaincodeExecute());
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.chaincodeExecute(0));
	}
});
app.get("/chaincodeTest", function(req, res) {
	try {
		res.send(render.chaincodeTest());
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.chaincodeTest(0));
	}
});
app.get("/techSupport", function(req, res) {
	try {
		res.send(render.techSupport());
	} catch(e) {
		console.log(" Error retrieving initial hyperledger info "+e);
		return res.send(render.techSupport(0));
	}
});
app.get('/transactions/:uuid', function(req, res) {
	try {
		var uuid =  req.params.uuid.substring(1);
		console.log('uuid  requested ',uuid);
		peerIntf.transactions(uuid, function (obj) {
			res.send(obj);
		});
	} catch(e) {
		res.send({});
	}
});
app.post('/getDockerLog', function(req, res) {
    console.log("getDockerLog");
    console.log("!!!!!data  ="+req.body.data);
    var arg_data = req.body.data;
    mysql.query("select * from peernode where PeerName=?",[req.body.peerName],function(err,results,fields){
        if(results.length == 1){
            var docker = new Docker({host: 'http://'+results[0].Ip, port: 2375});
            if(docker == null){
                res.send("��������ʧ��");
                return;
            }
            docker.listContainers(function (err, containers) {
                console.log("/dev-"+req.body.peerName+"-"+req.body.chaincodeId);
                var result =[];
                var msg ="������...";
                var code =100;
                containers.forEach(function (containerInfo) {
                    if(containerInfo.Names[0]=="/dev-"+req.body.peerName+"-"+req.body.chaincodeId){
                        console.log(" success!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
                        msg ="����ɹ�";
                        code=200;
                    }
                });
                //���û�з�������������vpNode����־�Ƿ��д���
                var container = docker.getContainer(results[0].ContainerId);
                var timestamp = (Date.parse(new Date())/1000)-60;
                console.log(results[0].ContainerId);
               containerLogs(container,timestamp,req.body.chaincodeId,function (logResult) {
                   if(logResult !=""){
                       console.log("log error"+logResult);
                       res.send(new RetMsg(500,"����ʧ��",logResult));
                   }else {
                       console.log(" no log error");
                       res.send(new RetMsg(code,msg,result));
                   }
                });
            });
        }else {
            res.send("����������");
        }
    });
});
app.get('/deleteDeployByChaincodeId', function(req, res) {
    if(!checkParams(req.query.chaincodeId)){
        return res.send(new RetMsg(100,"��������",""));
    }
    mysql.query("delete from deploychaincode where ChaincodeId=?",req.query.chaincodeId,function(err,results,fields){
        if(results.affectedRows ==0){
            return res.send(new RetMsg(200,"û������ɾ��",""));
        }else {
            return res.send(new RetMsg(200,"ɾ���ɹ�",results));
        }
    });
});
// app.get('/getDockerLog', function(req, res) {
//     console.log("getDockerLog");
//
//     console.log(req.query.peerName);
//     mysql.query("select * from peernode where PeerName=?",[req.query.peerName],function(err,results,fields){
//         if(results.length == 1){
//             var docker = new Docker({host: 'http://'+results[0].Ip, port: 2375});
//             if(docker == null){
//                 res.send("��������ʧ��");
//                 return;
//             }
//             var container = docker.getContainer(results[0].ContainerId);
//             containerLogs(container,function (obj) {
//                     res.send(obj);
//                 });
//
//         }else {
//             res.send("����������");
//         }
//
//
//
//
//     });
// });
 app.get('/test', function(req, res) {
    // var timestamp = (Date.parse(new Date())/1000)-60;
    //      console.log(req.query.peerName);
    // mysql.query("select * from peernode where PeerName=?",[req.query.peerName],function(err,results,fields){
    //     if(results.length == 1){
    //         var docker = new Docker({host: 'http://'+results[0].Ip, port: 2375});
    //         if(docker == null){
    //             res.send("��������ʧ��");
    //             return;
    //         }
    //         var container = docker.getContainer(results[0].ContainerId);
    //         containerLogs(container,timestamp,function (obj) {
    //                 res.send(obj);
    //             });
    //
    //     }else {
    //         res.send("����������");
    //     }
    //
    //
    //
    //
    // });
     // e5075e055f1660d0d44eacb03b807e5092e5fbe8a5104ecb059845d4342be4ca7414cf321f0ac942d103b89ad7b86c3d8b4740e8c21aace4ba233761c5b9c332
     // e5075e055f1660d0d44eacb03b807e5092e5fbe8a5104ecb059845d4342be4ca7414cf321f0ac942d103b89ad7b86c3d8b4740e8c21aace4ba233761c5b9c332
     var aa ="052[chaincode] Launch -> ERRO 1b4 sending init failed(Error initializing container e5075e055f1660d0d44eacb03b807e5092e5fbe8a5104ecb059845d4342be4ca7414cf321f0ac942d103b89ad7b86c3d8b4740e8c21aace4ba233761c5b9c332: Incorrect number of arguments. Expecting 4)"
     // if(aa.indexOf("Launch -> ERRO") > -1 && aa.indexOf("e5075e055f1660d0d44eacb03b807e5092e5fbe8a5104ecb059845d4342be4ca7414cf321f0ac942d103b89ad7b86c3d8b4740e8c21aace4ba233761c5b9c332") > -1){
     //     res.send("yes");
     //     return;
     // }
     console.log(aa.substring(aa.indexOf("[chaincode]")));
     res.send("����������");
 });
//��ȡ������־
function containerLogs(container,timestamp,ContainerId,callBak) {
	var result ="";
    // create a single stream for stdin and stdout
    var logStream = new stream.PassThrough();
    logStream.on('data', function(chunk){
       // result +=chunk.toString('utf8')+"<br/>";
      //  console.log(chunk.toString('utf8'));
        var temp =chunk.toString('utf8');
        if(temp.indexOf("Launch -> ERRO") > -1 &&temp.indexOf(ContainerId) > -1){
            console.log("has log error");
            result = temp.substring(temp.indexOf("[chaincode]"));
        }
    });
    container.logs({
        follow: false,
        stdout: true,
        stderr: true,
        since: timestamp
    }, function(err, stream){
        if(err) {
            return err.message;
        }
        container.modem.demuxStream(stream, logStream, logStream);
        stream.on('end', function(){
            logStream.end('!stop!');
            console.log(result);
            callBak(result) ;
        });
        setTimeout(function() {
            stream.destroy();
        }, 2000);
    });
}
//�������ܺ�Լ
app.get('/deploy', function(req, res) {
    try {
    	var  type = req.query.type;
    	if(type ==undefined ||type ==""){
            console.log("no type");
            return res.send(new RetMsg(100,"��������","no type"));
		}
        if(req.query.id ==undefined || req.query.id ==''){
            return res.send(new RetMsg(100,"��������",""));
        }
        //����ǰ�����deployFolder
        deleteFile(deployFolder+"/*");
		if(type =="example2"){
            var user1=req.query.user1;
            var user1money =req.query.user1money;
            var user2 = req.query.user2;
            var user2money = req.query.user2money;
            var args =[user1,user1money,user2,user2money];
            var paramsExample="�û�1���֣�"+user1+"���˻��˻���"+user1money+"<br>�û�2���֣�"+user2+"���˻��˻���"+user2money;
            var smartCodeName ="ƽ̨�ṩ(ת��ʾ��)";
            mysql.query("select * from uploadchaincode where pk_Id=?",req.query.id,function(err,results,fields){
                if(results.length !=1){
                    return res.send(new RetMsg(100,"�����ܺ�Լ������",""));
                }
                path=results[0].MainPath;
                deployCommon(args,path,paramsExample,req,res,results[0].Description,smartCodeName);
            });
		}
		if(type =="map"){
            var mapKey= req.query.mapKey;
            var mapValue = req.query.mapValue;
            var paramsExample="key��"+mapKey+"<br>value��"+mapValue;
            var args =[mapKey,mapValue];
            var smartCodeName ="ƽ̨�ṩ(ͨ�����ݴ洢)";
            mysql.query("select * from uploadchaincode where pk_Id=?",req.query.id,function(err,results,fields){
                if(results.length !=1){
                    return res.send(new RetMsg(100,"�����ܺ�Լ������",""));
                }
                //�������ܺ�Լ
                exec('cp -r '+results[0].UploadPath+'/* '+deployFolder,function(err,out) {
                    console.log(out); err && console.log(err);
                });
                path=results[0].MainPath;
                deployCommon(args,path,paramsExample,req,res,results[0].Description,smartCodeName);
            });
		}
		if(type =="userUpload"){
		    console.log("here upload");
            var args =[];
		    var params = req.query.params.split(",");
            var paramsExample="";
		    for(i=0;i<params.length ;i++){
		        args.push(params[i]);
		        var num =i+1;
		        paramsExample +="����"+num+"��"+params[i]+"<br>";
            }
            mysql.query("select * from uploadchaincode where pk_Id=?",req.query.id,function(err,results,fields){
                if(results.length !=1){
                    return res.send(new RetMsg(100,"�����ܺ�Լ������",""));
                }
                var smartCodeName ="�û��ϴ�("+results[0].Name+")";
                console.log(args);
                console.log(results[0].MainPath);
                //�������ܺ�Լ
                exec('cp -r '+results[0].UploadPath+'/* '+deployFolder,function(err,out) {
                    console.log(out); err && console.log(err);
                });
                deployCommon(args,results[0].MainPath,paramsExample,req,res,results[0].Description,smartCodeName);
            });
        }
    } catch(e) {
        res.send({});
    }
});
function deployCommon(args,path,paramsExample,req,res,description,smartCodeName) {
    peerIntf.deploy(args,path, function (obj) {
        console.log(obj);
        if(undefined == obj){
            return res.send(new RetMsg(100,"����ʧ��",""));
        }
        if(obj.error !=undefined){
            res.send(new RetMsg(100,"����ʧ��",obj.error.data));
        }
        if(obj.result.status =="OK"){
            console.log( ' return resp ' , obj.result.message);
            mysql.query("select * from deploychaincode where ChaincodeId=?",obj.result.message,function(err,results,fields){
                if(results.length ==0){
                    var data = {fk_uploadchaincode_Id:req.query.id,ChaincodeId:obj.result.message,Params:paramsExample,ChaincodeName:req.query.chaincodeName,ChaincodeType:smartCodeName,Description:description};
                    mysql.query("insert into deploychaincode set ?",data,function(err,results,fields){
                        //do something
                        console.log("err = "+err);
                        console.log("results.insertId =  = "+results.insertId);
                        console.log("fields = "+fields);
                        var retData ={vp:getLoginUser(),path:path,chaincodeId:obj.result.message};
                        return res.send(new RetMsg(200,"����ɹ�",retData));
                    });
                }else {
                    return res.send(new RetMsg(100,"������ͬ,�����ܺ�Լ�Ѳ���",""));
                }
            })
        }else {
            res.send(new RetMsg(100,"����ʧ��",""));
        }
    });
}
//�ڵ������
app.get('/vpNodeController', function(req, res) {
	console.log("req");
	console.log(req.query);
    if(req.query.peerName ==undefined ||req.query.peerName ==''|| req.query.operation ==undefined ||req.query.operation ==''){
        res.send(new RetMsg("100","��������",""));
    }
    // if(req.query.operation !='stop' && req.query.operation !='start'){
    //     res.send(new RetMsg("100","������������",""));
    //     return;
    // }
    var msg='';
    mysql.query("select * from peernode where PeerName=?",[req.query.peerName],function(err,results,fields){
        if(results.length == 1){
			console.log("�������ӡ�����");
            var docker = new Docker({host: 'http://'+results[0].Ip, port: 2375});
            if(docker == null){
                res.send("��������ʧ��");
				console.log("��������ʧ�ܡ�����");
            }
			console.log(results[0]);
            var container = docker.getContainer(results[0].ContainerId);
			console.log(container);
            // container.inspect(function (err, data) {
            //     console.log(data);
            // });
            if(req.query.operation == 'true'){
                container.start(function (err, data) {
					console.log(data);
                    console.log('start');
                    msg ='�����ɹ�';
                    res.send(new RetMsg("200",msg,""));
                });
            }
            if(req.query.operation == 'false'){
                container.stop(function (err, data) {
                    console.log('stop');
                    msg ='ֹͣ�ɹ�';
                    res.send(new RetMsg("200",msg,""));
                });
            }
        }else {
            res.send(new RetMsg("100","����������",""));
        }
    });
});
//������־�鿴ҳ��
app.get('/logCheck', function(req, res) {
    try {
        res.send(render.logCheck());
    } catch(e) {
        console.log(" Error retrieving initial hyperledger info "+e);
    }
});
app.get('/deployEntityList', function(req, res) {
    console.log( 'deployEntityList');
    if(req.query.page <1){
        return res.send(new RetMsg("100","ҳ������С��1",""));
    }
    var size = parseInt(req.query.size);
    var pageStart =(req.query.page-1)*size;
    var count =0;
    mysql.query("select count(*) as count from deploychaincode","",function(err,results,fields){
        count = results[0].count;
        mysql.query("select * from deploychaincode order by pk_Id desc limit ?,?",[pageStart,size],function(err,results,fields){
            //  var obj = JSON.parse(JSON.stringify(results));
            var data={"count":count,"data":results};
            return res.send(new RetMsg("200","��ѯ�ɹ�",data));
        });
    });
});
//��־�鿴�б�
// app.get('/getLogList', function(req, res) {
//     var querySql =' 1=1 ';
//     if(checkParams(req.query.startDate)){
//         querySql +="and CreateDate > '"+req.query.startDate+"'";
//     }
//     if(checkParams(req.query.endDate)){
//         querySql +="and CreateDate < '"+req.query.endDate+"'";
//     }
//     if(checkParams(req.query.operation)){
//         querySql +="and Operation='"+req.query.operation+"'";
//     }
//     if(checkParams(req.query.transactionId)){
//         querySql +="and TransactionId='"+req.query.transactionId+"'";
//     }
//     if(checkParams(req.query.chaincodeId)){
//         querySql +="and ChaincodeId='"+req.query.chaincodeId+"'";
//     }
//     console.log(querySql);
//
//     if(req.query.page <1){
//         return res.send(new RetMsg("100","ҳ������С��1",""));
//     }
//     var size = parseInt(req.query.size);
//     var pageStart =(req.query.page-1)*size;
//     var count =0;
//     mysql.query("select count(*) as count from log where "+querySql,"",function(err,results,fields){
//         count = results[0].count;
//         mysql.query("select * from log where "+querySql+" order by pk_Id desc limit ?,? ",[pageStart,size],function(err,results,fields){
//             //  var obj = JSON.parse(JSON.stringify(results));
//             var data={"count":count,"data":results};
//             return res.send(new RetMsg("200","��ѯ�ɹ�",data));
//
//         });
//     });
//
//
//
// });
function checkParams(params) {
    if(params ==undefined || params ==''){
        return false;
    }else {
        return true;
    }
}
// app.get('/showSmartCodeList', function(req, res) {
//     console.log( 'showSmartCodeList');
//     if(req.query.page <1){
//         return res.send(new RetMsg("100","ҳ������С��1",""));
// 	}
//     var size = parseInt(req.query.size);
//     var pageStart =(req.query.page-1)*size;
// 	var count =0;
//     mysql.query("select count(*) as count from uploadchaincode","",function(err,results,fields){
//         count = results[0].count;
//         mysql.query("select * from uploadchaincode limit ?,?",[pageStart,size],function(err,results,fields){
//             //  var obj = JSON.parse(JSON.stringify(results));
//             var data={"count":count,"data":results};
//             return res.send(new RetMsg("200","��ѯ�ɹ�",data));
//         });
//     });
//
//
// });
app.get('/generateChannelFile', function(req, res){
	//1. ���û���
	// export FABRIC_CFG_PATH=/opt/fabric-1.0/app-network/new_artifacts/channel
	//2. ִ������
	// /usr/local/bin/configtxgen -profile TwoOrgsChannel -outputCreateChannelTx ./new_artifacts/channel.tx -channelID mychannel
	var channelName = req.query.channelName;
	console.log("ִ������: " + channelName);
	return res.send(new RetMsg("200", "ok", null));
});
//��������id�����ݿ�
function addVpNodeToDatabase(peer) {
    var ip =peer.address.toString().split(":")[0];
    var name = peer.ID.name;
    //
    var docker = new Docker({host: 'http://'+ip, port: 2375});
    if(docker ==null){
        console.log("docker is null "+ip);
        return;
    }
    docker.listContainers(function (err, containers) {
        containers.forEach(function (containerInfo) {
            //console.log(containerInfo);
            if(containerInfo.Names[0].replace("_","").replace("/","") == name){
                mysql.query("select * from peernode where PeerName=?",[name],function(err,results,fields){
					
                    //���vpNode���Ʋ������ݿ⣬����
                    if(!results || results.length ==0){
                        var data = {PeerName:name,Ip:ip,ContainerId:containerInfo.Id};
                        mysql.query("insert into peernode set ?",data,function(err,results,fields){});
                    } else if(results.length ==1){//������ڣ���鿴containId�Ƿ�仯���仯�����
                        if(results[0].ContainerId !=containerInfo.Id){
                            var updateData =[ip,containerInfo.Id,results[0].pk_Id];
                            mysql.query("update peernode set Ip=?, ContainerId=? where pk_Id=?",updateData,function(err,results,fields){});
                        }
                    }
                });
            }
        });
    });
}
var locked = false;
var initial = true;
var channelName = '';//config.defaultChannelName;
app.get('/changeChannel', function(req, res) {
    if(!checkParams(req.query.channelName)){
        return res.send(new RetMsg("100", "��������", null));
    }
    ledgerData.blocks =[];// {"peer_num":peer_num ,"chain" : { "height" : {"low" : 0}} , "total_peers" : [] , "peers" : {} , "blocks" : []};
    channelName = req.query.channelName;
    return res.send(new RetMsg("200", "�޸ĳɹ�", null));
});
//��ȡ��ǰchannel
app.get('/getCurrentChannel', function(req, res) {
    if(!checkParams(channelName)){
        return res.send(new RetMsg("100", "��ȡʧ��", null));
    }else {
        return res.send(new RetMsg("200", "��ȡ�ɹ�", channelName));
    }
});
app.get("/channelManager", function(req, res) {
    try {
        res.send(render.channelManager());
    } catch(e) {
        console.log(" Error retrieving initial hyperledger info "+e);
        return res.send(render.channelManager(0));
    }
});
var getLedgerInfo = function(callBk) {
	if(locked) {
		console.log('Waiting to retrieve ledger data ...');
		setTimeout(function(){ getLedgerInfo(callBk);}, 1000);
		return;
	}
	try {
	    if(config.neverGetLedgerData){
            console.log('never Get LedgerData ');
            getInfo(callBk)
        }else {
            //�����ʼʱû��channelName���������ݿ���channel�ĵ�һ��
            if(channelName ==''){
                //select * from channel order by pk_Id asc
                mysql.query("select * from channel order by pk_Id asc ","",function(err,results,fields){
                    if(results.length ==0){
                        console.log('no channel ');
                        getInfo(callBk)
                    }else {
                        console.log('get channelName in database ');
                        channelName=results[0].channelName;
                        getInfo(callBk)
                    }
                });
            }else {
                getInfo(callBk);
            }
        }
	} catch(e) {
		console.log("here");
		console.log(e);
		locked = false;
		throw e;
	}
}
function stringToHex(array, start, end){
    var val="";
    for(var i = start; i < end; i++){
        var tmp = array[i].toString(16);
        if (tmp.length == 1) {
            tmp = "0" + tmp;
        }
        val += tmp;
    }
    return val;
}
function getInfo(callBk) {
    try {
        if(channelName ==''){
            callBk(ledgerData);
            return;
        }
        var currHeight = ledgerData.chain.height.low;
            var currentBlockHash_arr = ledgerData.chain.currentBlockHash;
            var currentBlockHash = stringToHex(currentBlockHash_arr.buffer.data, currentBlockHash_arr.offset, currentBlockHash_arr.limit);
		console.log("channelName = "+channelName);
		peerIntf.chain(
			channelName,
			function(obj) {
				ledgerData.chain = obj;
				//console.log("**************printMap(obj):"+printMap(obj));
				var blockFunc = function(obj) {
					ledgerData.blocks.push(obj);
					if(ledgerData.blocks.length > 20) {
						ledgerData.blocks[ledgerData.blocks.length - 21] = null;
					}
					currHeight = ledgerData.blocks.length;
					if(currHeight == ledgerData.chain.height.low) {
						callBk(ledgerData);
						locked = false;
					} else {
						peerIntf.block(channelName, (currHeight++),blockFunc);
					}
					console.log("**************!!!!!!!currHeight:"+currHeight+",ledgerData.chain.height.low:"+ledgerData.chain.height.low);
				}
				var new_channelcurrentBlockHash_arr = ledgerData.chain.currentBlockHash;
                var new_currentBlockHash = stringToHex(new_channelcurrentBlockHash_arr.buffer.data, new_channelcurrentBlockHash_arr.offset, new_channelcurrentBlockHash_arr.limit);
				if((!isNaN(currHeight) && currHeight != ledgerData.chain.height.low)||currentBlockHash!= new_currentBlockHash) {
                    console.log("**************!!!!!!!!!!!!!!!!!!!!!!!!!!!!currHeight != ledgerData.chain.height.low,  peerIntf.block");
					peerIntf.block(channelName, currHeight,blockFunc);
				}
				
			}
		);
    }
    catch(e) {
        console.log("here");
        console.log(e);
        locked = false;
        throw e;
    }
}
var newBlockArrived = true; //initial value is true
setInterval(
    function() {
        mysql.query("select * from peernode ","",function(err,results,fields){
            if(results.length !=0){
                results.forEach(function (peer) {
                  //  console.log(results[num].Ip);
                    var docker = new Docker({host: 'http://' + peer.Ip, port: 2375});
                    if (docker == null) {
                        console.log("docker is null " + ip);
                        return;
                    }
                    //var container = docker.getContainer('71501a8ab0f8');
                    docker.listContainers({
                        all: 1
                    },function (err, containers) {
                        containers.forEach(function (containerInfo) {
                            // console.log("-------------");
                            // console.log(containerInfo.Names[0]);
                            // console.log("-------------");
                            if (containerInfo.Names[0].replace("_", "").replace("/", "") == peer.PeerName) {
                             //  console.log(containerInfo.State);
                                var onlinw = false;
                                if(containerInfo.State =="running"){
                                    onlinw = true;
                                }
                              //  console.log("Names = " + containerInfo.Names[0] +"  "+peer.Online +" " +onlinw);
                                if(peer.Online !=onlinw){
                                    var updateData =[onlinw,peer.pk_Id];
                                    mysql.query("update peernode set Online=? where pk_Id=?",updateData,function(err,results,fields){});
                                }
                            }
                        });
                    });
                })
            }
        })
    },5000);
//initial load
getLedgerInfo( function () {
	try {
		console.log('***********Ledger data retrieved.');
		//start listener and Web sockets for updates
		var server = require('http').createServer(app);
		var io = require('socket.io')(server);
		//console.log('***********11111.');
		setInterval(
			function() {
				var prevPeers = ledgerData.peers;
				var prevHeight = ledgerData.chain.height.low;
				 var currentBlockHash_arr = ledgerData.chain.currentBlockHash;
                 var currentBlockHash = stringToHex(currentBlockHash_arr.buffer.data, currentBlockHash_arr.offset, currentBlockHash_arr.limit);
				var newData = {};
				getLedgerInfo( function() {
					console.log("***********ledgerData.chain.height:"+ledgerData.chain.height.low);
					if(JSON.stringify(prevPeers) != JSON.stringify(ledgerData.peers))
						newData.peers = ledgerData.peers;        
                   var new_channelcurrentBlockHash_arr = ledgerData.chain.currentBlockHash;
                  var new_currentBlockHash = stringToHex(new_channelcurrentBlockHash_arr.buffer.data, new_channelcurrentBlockHash_arr.offset, new_channelcurrentBlockHash_arr.limit); 					
					if((prevHeight != ledgerData.chain.height.low)||currentBlockHash!=new_currentBlockHash) {
						console.log("***********prevHeight != ledgerData.chain.height.low)||currentBlockHash!=new_currentBlockHash*****");
						newData.chain = ledgerData.chain;
						newBlocks = new Array();
						for(var i = prevHeight; i < ledgerData.chain.height.low; i++)
						   {  
							console.log("***********push newBlocks!!!!! *****,i:"+i);
							 newBlocks.push(ledgerData.blocks[i]);
						   }
						newData.blocks = newBlocks;
					}
					if(newData.peers || newData.blocks) {
                        console.log("***********emit update !!!!!! *****");
						io.emit('update', JSON.stringify(newData));
						newBlockArrived= true;
					}
				});
			}
			, 2000);	    
		setInterval(
			function() {
				if(!newBlockArrived)
					return;
				newBlockArrived = false;
				var endSecs = -1;
				var txnRate = 0;
				var blkRate = 0;
				var txnCount = 0;
				var txnLatency = 0;
				var currTime;
				var blkTxGraph = {
					block : [],
					txs: []
				}
				var txRateGraph = {"time":[],"txRate":[]}
				var blkRateGraph = {"time":[],"blkRate":[]}
				statsData = {
					"checkTime" : "",
					"avgTxnLatency" : "",
					"txnRate": "",
					"mineRate": "",
					"txRateGraph":txRateGraph,
					"blkRateGraph":blkRateGraph
				};
				for (var i = ledgerData.chain.height.low - 1; i > 0; i--) {
					// console.log("**********ledgerData.chain.height.low:"+ledgerData.chain.height.low);
					if(txRateGraph.time.length == 20) {
						break;
					}
					var block = ledgerData.blocks[i];
					//console.log("**********block data :"+block);
					if (!block) {//|| !block.nonHashData || !block.transactions
						continue;
					}
					if (blkTxGraph.block.length < 20) {
						//console.log("**********blkTxGraph.block.push("+i+")");
						blkTxGraph.block.push(i);
						blkTxGraph.txs.push(block.data.data.length);//block.transactions.length
						//console.log("**********block.data.data.length:"+block.data.data.length);
					}
					var date=new Date(block.data.data[block.data.data.length-1].payload.header.channel_header.timestamp);
					//console.log("**********date.getTime():"+date.getTime()+",*****i:"+i+","+block.data.data[block.data.data.length-1].payload.header.channel_header.timestamp);
					if (endSecs < 0) {
                         
						endSecs = date.getTime();//nonHashData.localLedgerCommitTimestamp.seconds;
						console.log("********endSecs:"+endSecs);
						currTime = new Date(null);
						currTime.setTime(endSecs);
						console.log("********endSecs.setTime:"+currTime);
						//currTime = currTime.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1");
						currTime=formatDateTime(currTime);
						console.log("currTime:"+currTime);
					}
					if (date.getTime() >= (endSecs - 2000)) {//block.nonHashData.localLedgerCommitTimestamp.seconds 
						blkRate++;
						//console.log("************blkRate:"+blkRate);
						for (var k = 0; k < block.data.data.length; k++) {//block.transactions.length
							txnRate++;
							txnCount++;
						    //txnLatency += (block.nonHashData.localLedgerCommitTimestamp.seconds - block.transactions[k].timestamp.seconds);
							txnLatency += (date.getTime() - new Date(block.data.data[k].payload.header.channel_header.timestamp).getTime());
						}
					} 
					else{
						
						txnRate = Math.round(txnRate/2);
						blkRate = Math.round(blkRate/2);
						statsData = {
							"checkTime" : currTime,
							"avgTxnLatency" : Math.round((txnLatency/txnCount)*1000),
							"txnRate": txnRate,
							"mineRate": blkRate
						}
							//console.log("******1111111******statsData.txnRate"+statsData.txnRate+","+blkRate);
						txRateGraph.time. push( currTime);
						txRateGraph.txRate. push( txnRate);
						blkRateGraph.time. push( currTime);
						blkRateGraph.blkRate. push( blkRate);
						endSecs = -1;
						txnRate = 0;
						blkRate = 0;
						txnCount = 0;
						txnLatency = 0;
					}
					
				}
                  //console.log("******2222******statsData"+statsData);
				statsData = {
					"checkTime" : statsData.checkTime,
					"avgTxnLatency" : statsData.avgTxnLatency,
					"txnRate": statsData.txnRate,
					"mineRate": statsData.mineRate,
					"txRateGraph":txRateGraph,
					"blkRateGraph":blkRateGraph
				}
				
				statsData.txRateGraph = { "time" : txRateGraph.time.reverse() , "txRate" :txRateGraph.txRate.reverse() };
				statsData.blkRateGraph = { "time" : blkRateGraph.time.reverse() , "blkRate" : blkRateGraph.blkRate.reverse() };
				statsData.blkTxGraph = { "block" : blkTxGraph.block.reverse() , "txs" : blkTxGraph.txs.reverse() };
				//simulated values for now. Will be fixed soon.
				var x = Math.floor(Math.random() * 95) + 76,y=Math.floor(Math.random() * 106) + 91,z=Math.floor(Math.random() * 64) + 37
				statsData.chTx = { "chainCodes" : ["ch01","ch02","ch03"] , "counts": [x,y,z] };
				var x= Math.floor(Math.random() * 834) + 631,y=Math.floor(Math.random() * 232) + 46,z=Math.floor(Math.random() * 56) + 32
				statsData.apprTx = { "stats" : ["Approved","Pending","Rejected"] , "counts": [x,y,z] };
				//console.log("******3333******statsData"+statsData);
				//console.log("statsData");
				//console.log(statsData);
				//console.log(' statsData ',statsData);
				io.emit('stats',JSON.stringify(statsData));
			}
			, 5000);
		server.listen(config.HTTP_PORT);
	} catch(e) {
		console.log('******����:'+"name: " + e.name + "message: " + e.message + "lineNumber: " + e.lineNumber + "fileName: " + e.fileName + "stack: " + e.stack);//kojh
		console.log('Ledger data initialization failed.');
		process.exit(-1);
	}
});
function printArray(arr)
{
	 var str=""
    for(var item in arr) {
     str=str+item+":"+printMap(arr[item])+",";    
     }  
    return str;
}
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
 function  ObjStory(name,address,type,pkiID,online) //��������
 {
        this.name = name;
        this.address= address;
        this.type= type;
        this.pkiID = pkiID;
       this.online = online;
 }
 function RetMsg(code,msg,data) {
	 this.code = code;
	 this.msg = msg;
	 this.data = data;
 }
 var formatDateTime = function (date) {  
    var y = date.getFullYear();  
    var m = date.getMonth() + 1;  
    m = m < 10 ? ('0' + m) : m;  
    var d = date.getDate();  
    d = d < 10 ? ('0' + d) : d;  
    var h = date.getHours();  
    var minute = date.getMinutes();  
	var second = date.getSeconds(); 
    minute = minute < 10 ? ('0' + minute) : minute;  
	second = second < 10 ? ('0' + second) : second;  
   // return y + '-' + m + '-' + d+' '+h+':'+minute+":"+second;  
   return h+':'+minute+":"+second;  
}; 