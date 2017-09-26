/*
 Copyright DTCC 2016 All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

var App = angular.module("explorer", ['ngAnimate','ngSanitize']);
const REST_ENDPOINT = '';

// http request to get get chain information
App.factory("SERVICE_HEIGHT", function(){
    return{
        getData: function(){
            return ledgerData.chain;
        }}
});

/* http request to retrieve information related to a specific block number found on the chain, chain_index is the block number that we wish to retrieve
 Since each request comes back at a different time and out of order, the order with which we recieve the response cannot be tracked, array_location is thus passed in and is added
 as metadata to keep track of the 0-9 index where the data should be added to the array in the BLOCKS_and_TRANSACTIONS controller that holds the final retrieved inorder result
 avoids sorting in the future */
App.factory("SERVICE_BLOCK", function($http) {
    return {
        getData: function(chain_index, array_location) {
            // initially returns only a promise
            return $http.get(REST_ENDPOINT +"/blocks/:"+ chain_index).then(function(result) {
                // add metadata
                result.data.location = array_location; // will always be 0-9 since the explorer displays the 10 most recent blocks
                result.data.block_origin = chain_index; // can be any number from 0 to the current height of the chain
                return result.data // retrieved data returned only after response from server is made
            });
        }
    }
});

// http request to get block information by block#, used in search, doesn't add any metadata
App.factory("REST_SERVICE_BLOCK", function($q,$http) {
    return {
        getData: function(chain_index) {
            if(ledgerData.blocks[chain_index]) {
                var deferred = $q.defer();
                deferred.resolve(ledgerData.blocks[chain_index]);
                return deferred.promise;
            } else
                return $http.get(REST_ENDPOINT+ "/api/v1/channel/mychannel/block/"+ chain_index).then(function(result){
                    console.log("result.data");
                    console.log(result.data);
                    if(result.data) {
                        return result.data;
                    }
                    else {
                        return null;
                    }

                });
        }}
});

// http request to get transaction information by UUID, used in search
App.factory("REST_SERVICE_TRANSACTIONS", function($http){
    return{
        getData: function(uuid){
            //alert("REST_ENDPOINT"+REST_ENDPOINT);
            return $http.get(REST_ENDPOINT+ "/transactions/:"+ uuid).then(function(result){
                return result.data;
            });
        }}
});

App.factory("REST_SERVICE_DEPLOY", function($http){
    return{
        getData: function(params){
            return $http.get(REST_ENDPOINT+ "/deploy?"+ params).then(function(result){
                return result.data;
            });
        }}
});

App.factory("REST_SERVICE_GET", function($http){
    return{
        getData: function(method,params){
            return $http.get(REST_ENDPOINT+method+ params).then(function(result){
                return result.data;
            });
        }}
});

App.factory("REST_SERVICE_POST", function($http){
    return{
        getData: function(method,params){
            return $http.post(REST_ENDPOINT+method+ params).then(function(result){
                return result.data;
            });
        }}
});


/* factory to share information between controllers, the BLOCK controller gets the 10 most recent blocks, parses the information
 and then puts the all the transactions from the 10 recent blocks into an array that gets broadcasted to the TRANSACTION controller that displays it. Likewise, chain
 information also broadcasted to controllers one retrieved
 */
App.factory("SHARE_INFORMATION", function($rootScope){
    var BlockInfo = {};

    BlockInfo.load_broadcast_transactions = function(data){
        this.transactions = data;
        this.broadcastItem();
    }
    BlockInfo.load_broadcast_chain = function(data){
        this.chain = data;
        this.broadcastItem();
    }
    BlockInfo.broadcastItem = function(){
        $rootScope.$broadcast("handle_broadcast");
    }

    var rc= $rootScope;
    var latestBlock = -1;
    var locked = false;
    var newData = null;
    window.lock = function() {
        locked= true;
        //console.log('locked');
    }
    window.redraw = function() {
        //console.log('redraw',newData);
        //console.log('unlocking');
        if(newData) {
            statsData = newData;
            rc.$broadcast("stats_broadcast_upd");
        }
        locked = false;
        newData = false;
    }
    window.addEventListener("load", function () {
        var socket = io('http://'+window.location.host);
        socket.on('stats', function (msg)
        {
            //console.log(' OLD ' , statsData);
            //console.log(' NEW ',msg)
            if(locked) {
                newData =  JSON.parse(msg);;
                console.log('locked');
            } else {
                rc.$broadcast("stats_broadcast_upd");
                statsData = JSON.parse(msg);
            }

        });
        socket.on('update', function (msg) {  // edit by lmd 20170919,suit Fabric1.0's block data struct
            console.log("11111111");
            console.log(ledgerData);
           // ledgerData = {"peer_num":peer_num ,"chain" : { "height" : {"low" : 0}} , "total_peers" : [] , "peers" : {} , "blocks" : []};

            var data = JSON.parse(msg);
            if(data.chain) {
                ledgerData.chain = data.chain;
                ledgerData.chain.cssClass = 'fade';
            }
            if(data.peers) {
                for( var i = 0; i < data.peers.length; i++) {
                    data.peers[i].cssClass='fade';
                }
                ledgerData.peers = data.peers;
            }
            if(data.blocks) {
                if(latestBlock > 0)
                    for( var i = latestBlock; i < ledgerData.blocks.length; i++) {
                        ledgerData.blocks[i].cssClass= undefined;

                        for( var j = 0; j < ledgerData.blocks[i].data.data.length; j++) {
                            ledgerData.blocks[i].data.data[j].cssClass=undefined;
                        }
                    }
                latestBlock = ledgerData.blocks.length;
                for( var i = 0; i < data.blocks.length; i++) {
                    data.blocks[i].cssClass='fade';
                    for( var j = 0; j < data.blocks[i].data.data.length; j++) {
                        data.blocks[i].data.data[j].cssClass='fade';
                    }
                }
                ledgerData.blocks = ledgerData.blocks.concat(data.blocks);
            }
            BlockInfo.chain = data.chain;
            rc.$broadcast("handle_broadcast_upd");

        });

		/*socket.on('connect', function(){

		 console.log('connect')
		 });

		 socket.on('disconnect', function(){

		 console.log('disconnect')
		 });*/

    })

    return BlockInfo;
})


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
/*-----------------------------Controllers for HTML div elements------------------------------------ */

App.controller("HEADER",
    function(){
    }
)

App.controller("NAVIGATION",
    function(){
    }
)


App.controller("CURRENT",
    function($scope, SERVICE_HEIGHT, SHARE_INFORMATION)
    {
        var loadFunc = function() {
            $scope.info = ledgerData.chain;

            var currentBlockHash = $scope.info.currentBlockHash;
            currentBlockHash.description = stringToHex(currentBlockHash.buffer.data, currentBlockHash.offset, currentBlockHash.limit);

            var previousBlockHash = $scope.info.previousBlockHash;
            //console.log( previousBlockHash.offset + " " + previousBlockHash.limit);
            previousBlockHash.description = stringToHex(previousBlockHash.buffer.data, previousBlockHash.offset, previousBlockHash.limit);



            SHARE_INFORMATION.load_broadcast_chain($scope.info);
        }
        $scope.info = {};
        $scope.$on("handle_broadcast_upd",function(){
            setTimeout(function(){
                $scope.info = ledgerData.chain;
				var currentBlockHash = $scope.info.currentBlockHash;
            currentBlockHash.description = stringToHex(currentBlockHash.buffer.data, currentBlockHash.offset, currentBlockHash.limit);
            var previousBlockHash = $scope.info.previousBlockHash;
            //console.log( previousBlockHash.offset + " " + previousBlockHash.limit);
            previousBlockHash.description = stringToHex(previousBlockHash.buffer.data, previousBlockHash.offset, previousBlockHash.limit);
                $scope.$apply();
            },30);

        });
        loadFunc();
    }
)

App.controller("SEARCH",
    function($scope, REST_SERVICE_TRANSACTIONS, REST_SERVICE_BLOCK)
    {

        //alert("ledgerData.blocks.length:"+ledgerData.blocks.length+",ledgerData.blocks[8].nonHashData"+ledgerData.blocks[4284].nonHashData);
        $scope.showLayer = false;
        $scope.search = function(){
            $scope.found = 0;
            // first we search by UUID
			
			 REST_SERVICE_TRANSACTIONS.getData($scope.response).then(function(data){
			 if(data)
			 {
			 $scope.info = data;
			 $scope.found = 1;
			 alert("date.timestamp:"+data.timestamp.seconds+",data.uuid"+data.uuid);
			 // convert transaction seconds to date
			 var date = getdate(data.timestamp.seconds);
			 //date.setSeconds(data.timestamp.seconds);
			 data.date = date;

			 // updated variables for output
			 $scope.message = "成功找到该事务";
			 $scope.text1 = "合约 ID: " +$scope.info.chaincodeID;
			 $scope.text2 = "UUID: " +$scope.info.txid;
			 $scope.text3 = "秒: " +$scope.info.timestamp.seconds;
			 $scope.text4 = "纳秒: " +$scope.info.timestamp.nanos;
			 $scope.text5 = null;
			 $scope.text6 = null;
			 $scope.text7 = "日期: " +$scope.info.date ;
			 }
			 });
			
            // Search by block number
            console.log("REST_SERVICE_BLOCK.getData");
            REST_SERVICE_BLOCK.getData($scope.response).then(function(data) {
                if (data) {
                    $scope.info = data;
                    $scope.found = 1;

                    // convert block timestamp
                    //var date = getdate(data.nonHashData.localLedgerCommitTimestamp.seconds);
                    //date.setSeconds(data.nonHashData.localLedgerCommitTimestamp.seconds);
                    //date.toISOString().substr(11, 8);
                    //data.nonHashData.localLedgerCommitTimestamp.date = date;
                    //alert("date:"+date);

                    //convert timestamps of all transactions on block
                    console.log("data");
                    console.log(data);
					/*
					 for (var k = 0; k < data.transactions.length; k++) {
					 //var date2 = new Date(null);
					 //date2.setSeconds(data.transactions[k].timestamp.seconds);
					 var date2=getdate(data.transactions[k].timestamp.seconds);
					 data.transactions[k].date = date2;
					 }
					 */

                    $scope.message = "成功找到该区块";
                    $scope.text1 = "状态哈希: " + $scope.info.header.data_hash;//stateHash;
                    $scope.text2 = "上一个哈希: " + $scope.info.header.previous_hash;//previousBlockHash;
                    //$scope.text3 = "共识元数据: " + ($scope.info.consensusMetadata || '');
                    //$scope.text4 = "秒: " + $scope.info.nonHashData.localLedgerCommitTimestamp.seconds;
                    //$scope.text5 = "纳秒: " + $scope.info.nonHashData.localLedgerCommitTimestamp.nanos;
                    $scope.text6 = null; // clear in to avoid displaying previous transaciton count if new block search has 0
                    $scope.text6 = "交易数: " + $scope.info.data.data.length;//transactions.length;
                    $scope.text7 = "日期: " + $scope.info.data.data[0].payload.header.channel_header.timestamp;//(date || '');

                    // display "View Transactions" button at bottom of information panel
                    if ($scope.info.data.data.length != null) {//$scope.info.transactions.length
                        document.getElementById("change").style.display = "block";
                    } else {
                        $scope.text6 = 0;
                        document.getElementById("change").style.display = "none";
                    }
                }
                ;
            });

            // if nothing is found searching by UUID or block number
            if($scope.found == 0){
                $scope.message = "找不到相关信息";
                $scope.info = null;
                $scope.text1 = null;
                $scope.text2 = null;
                $scope.text3 = null;
                $scope.text4 =  null;
                $scope.text5 = null;
                $scope.text6 = null;
                $scope.text7 = null;
                document.getElementById("change").style.display = "none";
            }

            //animate slideout only after the the information is ready to display
            setTimeout(function(){
                if(document.getElementById("panel").style.display != "none"){
                    // don't slide since panel is already visible
                } else{
                    $(document).ready(function(){
                        $("#panel").slideToggle(1000);});
                }}, 400);
        };
        $scope.clear = function(){
            $scope.response = "";
            if(document.getElementById("panel").style.display == "none"){
                // already hidden, don't wan't to animate again
                $scope.found= 0;
                $scope.info = null;
                $scope.message = null;
                $scope.text1 =  null;
                $scope.text2 =  null;
                $scope.text3 =  null;
                $scope.text4 =  null;
                $scope.text5 =  null;
                $scope.text6 = null;
                $scope.text7 = null;
            }
            else{
                // panel is visible, we need to hide it, JQuery used for animation
                $(document).ready(function(){
                    $("#panel").slideToggle(1000);
                });
                // after slideout animation is complete, clear everything
                setTimeout(function(){
                    $scope.found = 0;
                    $scope.info = null;
                    $scope.message = null;
                    $scope.text1 =  null;
                    $scope.text2 =  null;
                    $scope.text3 =  null;
                    $scope.text4 =  null;
                    $scope.text5 =  null;
                    $scope.text6 = null;
                    $scope.text7 = null;
                }, 100);
            }
        };


        $scope.openLayer = function () {
            $scope.showLayer = true;
        }
        $scope.closeLayer = function () {
            $scope.showLayer = false;
        }
    }
)

App.controller("CHAINCODE_LOG",
    function($scope,REST_SERVICE_GET){

        $scope.searchParams ='';
        $scope.search =function () {
            $scope.searchParams ='';
            //$scope.searchParams='&startDate='+$scope.startDate+"&endDate="+$scope.endDate+"&transactionId="+$scope.transactionId+"&operation="+$scope.operation;
            $scope.searchParams='';
            if( $scope.checkParams($('#startDate').val())){
                $scope.searchParams +='&startDate='+$('#startDate').val();
            }
            if( $scope.checkParams($('#endDate').val())){
                $scope.searchParams +="&endDate="+$('#endDate').val();
            }
            if( $scope.checkParams($('#transactionId').val())){
                $scope.searchParams +="&transactionId="+$('#transactionId').val();
            }
            if( $scope.checkParams($('#operation').val())){
                $scope.searchParams +="&operation="+$('#operation').val();
            }
            if( $scope.checkParams($('#chaincodeId').val())){
                $scope.searchParams +="&chaincodeId="+$('#chaincodeId').val();
            }
            //  console.log($scope.searchParams);
            $scope.getList(1);
        };

        $scope.checkParams =function (params) {
            if(params =="" ||params ==undefined){
                return false;
            }else {
                return true;
            }
        };

        //获取list和分页
        $scope.getList =function (page) {
            $scope.datas =[];
            REST_SERVICE_GET.getData("/api/v1/getLogList","?page="+page+"&size=10"+$scope.searchParams).then(function(data){
                if(data.data.count !=0){
                    $scope.datas =data.data.data;
                    $scope.pageCount=data.data.count;
                    $scope.totalPage = Math.ceil(data.data.count/10);
                    var GG = {
                        "kk":function(mm){
                            $scope.getList(mm);
                        }
                    };
                    $("#page").initPage(data.data.count,page,GG.kk);
                }else{
                    $scope.pageCount=0;
                    $scope.totalPage = 0;
                }

            });
        };

        $scope.getList(1);
    }
);

App.controller("CHAINCODE_DEPLOY",
    function($scope,REST_SERVICE_DEPLOY,REST_SERVICE_GET,REST_SERVICE_POST){

        //获取数据库channel
        $scope.Channel = "";
        REST_SERVICE_GET.getData("/api/v1/channelName","").then(function(data){
            if(data.length ==0){
                alert("请先创建channel");
                window.location.href ="/channelManager";
                return;
            }
            $scope.Channel =data;
            //获取当前的Channel
            REST_SERVICE_GET.getData("/getCurrentChannel","").then(function(data){
                console.log(data);
                if(data.code ==100){
                    alert("请先创建channel")
                }else {
                    $scope.selectChannel = data.data;
                }


            });

        });

        $scope.addExample =function () {
           // $scope.g_selectedChaincode

            if($scope.selectChannel ==''||$scope.selectChannel ==undefined){
                alert("请选择管道");
                return;
            }
            if($scope.chaincodeName ==''||$scope.chaincodeName ==undefined){
                alert("实例名字不能为空");
                return;
            }
            if($scope.chaincodeVersion ==''||$scope.chaincodeVersion ==undefined){
                alert("实例版本不能为空");
                return;
            }
            REST_SERVICE_POST.getData("/api/v1/newDeployChaincode/channel/"+$scope.selectChannel+"/chaincode/"+$scope.chaincodeName+"/"+$scope.chaincodeVersion+"/"+$scope.g_selectedChaincode.pk_Id,"").then(function(data){
                if(data.code ==200){
                    alert("操作成功");
                    $(".deploy-layer,.grey-background").hide();
                }else {
                    alert("操作失败");
                }

            });
        }



        $scope.uploadSuccess =false;
        $scope.deploySuccess =false;

        //上传部分
        $(function(){
            $('.btn-uploadContract').click(function () {
                $scope.uploadSuccess =false;
                $(".uploadContract-layer,.grey-background").show();
            });
            $('#upload-close').click(function(){
                $(".uploadContract-layer,.grey-background").hide();
            });
            $("#deleleUploadFile").click(function(){
                $("#uploadFileArea").hide();
                $("#uploadFile").val('');
            });
            $("#uploadFile").change(function(){
                $("#uploadFileArea").show();
                var fileNameEle = $("#fileName");
                var uploadFileEle = $("#uploadFile");
                var fileObj=uploadFileEle[0].files[0];
                var fileName = fileObj.name;
                var fileSize = fileObj.size / 1024 / 1024;
                fileNameEle.text(fileName);
            });
            $(".result-close").click(function(){
                if($scope.uploadSuccess){
                    $(".uploadContract-layer,.grey-background").hide();
                }
                if($scope.deploySuccess){
                    $(".deploy-layer,.grey-background").hide();
                }
                $(".result-layer,.grey-background2").hide();
            });
            $('#startUploadBtn').click(function(){
                var formData = new FormData($("#form")[0]);
                var data = $("#form").serializeArray();
                var file = $("#uploadFile").val();
                data.push({name:'file',value:file});
                for(var i = 0; i < data.length;i++) {
                    if (data[i].value == "") {
                        var nameList = ["合约名字","描述","文件"];
                        alert('请补充'+nameList[i]);
                        return false;
                    }
                }
                $.ajax({
                    type:"post",
                    url:'/singleUpload',
                    data:formData,
                    contentType: false,
                    processData: false,
                    beforeSend: function() {
                        $("#disabledUploadBtn").show();
                        $('#startUploadBtn').hide();
                    },
                    complete: function () {
                        $("#disabledUploadBtn").hide();
                        $('#startUploadBtn').show();
                    },
                    success:function(dataBack){
                        $("#disabledUploadBtn").hide();
                        $('#startUploadBtn').show();
                        if(dataBack.code == 200){
                            console.log("111111111");
                            $scope.uploadSuccess =true;
                            $scope.getList(1);
                            $(".result-layer,.grey-background2").show();
                            $("#resultSuccess").show();
                            $("#resultSuccessSpan").text("上传成功！");
                            $("#resultFail").hide();
                        }else{
                            $(".result-layer,.grey-background2").show();
                            $("#resultFail").show();
                            $("#resultFailSpan").text("上传失败！");
                            $("#retMsg").text(dataBack.msg);
                            $("#resultSuccess").hide();
                        }
                    }
                });
            });



        })
        
        $('#deployWinClose').click(function(){
            $(".deploy-layer,.grey-background").hide();
        });

        //用户点击部署时选择的智能合约
        $scope.g_selectedChaincode ='';

        $scope.deployClick = function (data) {
            //console.log(data);
            $scope.revertDeployWin();
            $(".deploy-layer,.grey-background").show();
            //根据不同的类型显示不同的
            $scope.showParamsTabByType(data.ChaincodeType,data.Name);
            $scope.g_selectedChaincode = data;

        };


        var g_data =[] ;
        var g_count =0;
        var g_stopShowLog =0;
        $scope.log="部署中";

        //重置部署框参数
        $scope.revertDeployWin =function () {
            g_data =[] ;
            g_count =0;
            g_stopShowLog =0;
            $scope.log="暂无信息";
            $("#logMsg").html($scope.log);

            //还原输入框
            $scope.chaincodeName='';
            $scope.user1='';
            $scope.user1money='';
            $scope.user2='';
            $scope.user2money='';
            $scope.mapKey = '';
            $scope.mapValue = '';

            $("#deployFail").css("display", "none");
            $("#deploySuccess").css("display", "none");

            $scope.deployBotton(true);

            $scope.paramsList=[];
            $scope.conf = [];
            $scope.userInput1 = '';

            $scope.deploySuccess = false;

        };



        function getlog(vp,arg_data,chaincodeId) {
            // if(g_stopShowLog){
            // return;
            // }
            // console.log(+vp);
            $.ajax({
                url: "/getDockerLog",
                data:{
                    peerName:vp,
                    data:arg_data,
                    chaincodeId:chaincodeId
                },
                type: "POST",
                success:function(data,status){
                    g_count++;
                    //部署超过30秒，则认为部署超时
                    if(g_count>50){
                        $scope.log+="<br>部署超时";
                        //g_stopShowLog =true;
                        window.clearInterval(g_stopShowLog);
                        $scope.deployBotton(true);

                    }
                    g_data =data.data;
                    var msg ='';
                    for(var i=0;i<g_data.length;i++){
                        msg+=g_data[i].Id+"  "+g_data[i].Names+"  "+g_data[i].State+"\n"
                    }
                    if(data.code==200){
                        $scope.deploySuccess =true;
                        $scope.msgTab('deployResult-success');
                        // g_stopShowLog =true;
                        window.clearInterval(g_stopShowLog);
                        $scope.log+="<br>部署成功";
                        $("#deployFail").css("display", "none");
                        $("#deploySuccess").css("display", "block");
                        $scope.deployBotton(true);

                        //成功弹出框
                        $(".result-layer,.grey-background2").show();
                        $("#resultSuccess").show();
                        $("#resultSuccessSpan").text("部署成功！");
                        $("#resultFail").hide();

                        //关闭部署框
                        // $(".deploy-layer,.grey-background").hide();
                    }
                    if(data.code==100) {
                        $scope.log+="..";
                    }
                    if(data.code==500){
                        $scope.log+="<br>部署失败<br>"+data.data;
                        //g_stopShowLog =true;
                        window.clearInterval(g_stopShowLog);
                        $scope.deployBotton(true);
                        REST_SERVICE_GET.getData("/deleteDeployByChaincodeId","?chaincodeId="+chaincodeId).then(function(data){
                            //     	console.log(data);

                        })
                    }
                    // console.log(msg);
                    //   console.log(data.code);
                    //   console.log(data.msg);
                    $("#logMsg").html($scope.log);
                    //   console.log($scope.log);
                }

            });
        }



        //获取list和分页
        $scope.getList =function (page) {

            $scope.datas =[];
            REST_SERVICE_GET.getData("/api/v1/chaincode","?page="+page+"&size=10").then(function(data){
                $scope.datas =data.data.data;

                var GG = {
                    "kk":function(mm){
                        $scope.getList(mm);
                    }
                };
                $scope.pageCount=data.data.count;
                $scope.totalPage = Math.ceil(data.data.count/10);
                $("#page").initPage(data.data.count,page,GG.kk);
            });
        };

        $scope.getList(1);

        $scope.startUpload =function () {
            $('#file_upload').uploadifive('upload');
        };

        //根据不同的智能合约类型显示不同的参数框
        $scope.showParamsTabByType = function (type,name) {
            if(type =="example2"){
                $("#userUplad_params").css("display", "none");
                $("#example2_params").css("display", "block");
                $("#map_params").css("display", "none");
                $scope.deployTitle ='转账示例（平台）';
                return;
            }
            if(type =="map"){
                $("#userUplad_params").css("display", "none");
                $("#example2_params").css("display", "none");
                $("#map_params").css("display", "block");
                $scope.deployTitle = '通用数据存储示例（平台）';
                return;
            }
            if(type =="userUpload"){
                $("#userUplad_params").css("display", "block");
                $("#example2_params").css("display", "none");
                $("#map_params").css("display", "none");
                $scope.deployTitle = name+'（用户上传）';
                return;
            }

        };

        $scope.msgTab =function (tab) {
            $('#'+tab).fadeIn();
            setTimeout(function(){
                $('#'+tab).fadeOut();
            },2000);
        };


        $scope.checkNum =function (num) {
            if(num ==""){
                return false;
            }
            //var reg = new RegExp("/^\d+(?=\.{0,1}\d+$|$)/");
            var regu = /^(\-|\+)?\d+(\.\d+)?$/;
            if(!regu.test(num)){
                return false;
            }else {
                return true;
            }
        };

        $scope.deployBotton =function (able) {
            if(able){
                $(".open-resultLayer").show();
                $(".disabledStyle").hide();
            }else {
                $(".open-resultLayer").hide();
                $(".disabledStyle").show();
            }
        };

        //部署按钮事件
        $scope.deploy = function(){
            var type = $scope.g_selectedChaincode.ChaincodeType;
            if($scope.chaincodeName =="" ||$scope.chaincodeName ==undefined){
                alert("实例名不能为空");
                return;
            }

            if(type=="example2"){
                if($scope.user1 =="" ||$scope.user1 ==undefined){
                    alert("用户1名字不能为空");
                    return;
                }
                if(!$scope.checkNum($scope.user1money)){
                    alert("用户1账户余额必须为数字");
                    return;
                }
                if($scope.user2 =="" ||$scope.user2 ==undefined){
                    alert("用户2名字不能为空");
                    return;
                }
                if(!$scope.checkNum($scope.user2money)){
                    alert("用户2账户余额必须为数字");
                    return;
                }
                if($scope.user1 ==$scope.user2){
                    alert("两个用户的名字不能相同");
                    return;
                }
                var params ="type="+type+"&user1="+$scope.user1+"&user1money="+$scope.user1money+"&user2="+$scope.user2+"&user2money="+$scope.user2money;
                params +="&id="+$scope.g_selectedChaincode.pk_Id+"&chaincodeName="+$scope.chaincodeName;
                $scope.commitDeploy(params);
                return;
            }
            if(type=="map"){
                //map 不需要key value
                // $scope.mapKey =1;
                // $scope.mapValue =1
                if($scope.mapKey =="" ||$scope.mapKey ==undefined){
                    alert("key不能为空");
                    return;
                }
                if($scope.mapValue =="" ||$scope.mapValue ==undefined){
                    alert("value不能为空");
                    return;
                }
                var params ="type="+type+"&mapKey="+$scope.mapKey+"&mapValue="+$scope.mapValue;
                params +="&id="+$scope.g_selectedChaincode.pk_Id+"&chaincodeName="+$scope.chaincodeName;
                $scope.commitDeploy(params);
                return;
            }
            if(type =="userUpload"){
                var params ="type="+type+"&id="+$scope.g_selectedChaincode.pk_Id+"&chaincodeName="+$scope.chaincodeName;
                var inputVal ='';
                //  console.log($scope.userInput1,$scope.conf);
                if($scope.checkUserInput($scope.userInput1,1) !=''){
                    return;
                }
                inputVal+='&params='+$scope.userInput1;
                for(var i=0;i<$scope.conf.length;i++){
                    if($scope.checkUserInput($scope.conf[i],i+2) !=''){
                        return;
                    }
                    inputVal+=','+$scope.conf[i];
                }
                params+=inputVal;
                //	console.log(params);

                $scope.commitDeploy(params);

            }
        };

        $scope.checkUserInput =function (params,index) {
            var reslut ='';
            if(params =="" ||params ==undefined){
                reslut ="参数"+index+"不能为空";
                alert(reslut);
                return reslut;

            }
            if(params.indexOf(',') > -1){
                reslut ="参数"+index+"不能含#号";
                alert(reslut);
                return reslut;
            }
            return reslut;
        };

        //通用提交智能合约表单
        $scope.commitDeploy =function (params) {
            //g_stopShowLog =false;
            $scope.deployBotton(false);
            $scope.log='提交中...<br>';
            $("#logMsg").html($scope.log);

            REST_SERVICE_DEPLOY.getData(params).then(function(data){
                // console.log(data);
                $scope.showDeployResult(data);

            });
        };

        //部署后的逻辑
        $scope.showDeployResult =function (data) {
            //	console.log(data);
            if(data.code ==200){
                var vp ='vp'+data.data.vp.replace("user","");
                //	console.log(vp);
                $scope.log+='正在部署链代码'+data.data.path+'<br>';
                $scope.log+='返回chaincode ID:'+data.data.chaincodeId+'<br>';
                $scope.log+='部署中';
                $("#logMsg").html($scope.log);
                g_stopShowLog =window.setInterval(function(){getlog(vp,g_data,data.data.chaincodeId)}, 3000);

            }else {
                $scope.msgTab('deployResult-fail');
                $scope.log='部署失败<br>';
                $scope.log+=data.data;
                $("#logMsg").html($scope.log);
                $scope.deployBotton(true);
                $("#deployFail").css("display", "block");
                $("#deploySuccess").css("display", "none");

                //失败弹出框
                $(".result-layer,.grey-background2").show();
                $("#resultFail").show();
                $("#resultFailSpan").text("部署失败！");
                $("#retMsg").text(data.msg);
                $("#resultSuccess").hide();
            }

        };

        // 部署智能合约——证据链（用户）增加参数
        $scope.paramsList=[];
        $scope.conf = [];
        $scope.add=function(){
            //  console.log($scope.userInput1,$scope.conf);
            $scope.paramsList.push({
            });
            $scope.conf.push('');
            //  console.log($scope.conf.length);
        };
        $scope.delete=function(index){
            $scope.paramsList.splice(index,1);
            $scope.conf.splice(index,1);
        }


    }
)

App.filter('trustHtml', function ($sce) {
    return function (input) {
        return $sce.trustAsHtml(input);
    }
});

App.controller("CHAINCODE_EXECUTE",
    function($scope,REST_SERVICE_GET,REST_SERVICE_POST){

    $scope.cleanData =function () {

    }

        //获取数据库智能合约
        $scope.deployChainCode = "";
        REST_SERVICE_GET.getData("/api/v1/chaincode","?page=1&size=1000","").then(function(data){
            if(data.length ==0){
                alert("请先创建ChainCode");
                window.location.href ="/chaincodeManager";
                return;
            }
            $scope.deployChainCode =data.data.data;

        });

        //获取list和分页
        $scope.getList =function (page) {
            $scope.datas =[];
            REST_SERVICE_GET.getData("/api/v1/deployChaincode","?page="+page+"&size=10").then(function(data){
                if(data.data.count !=0){
                    $scope.datas =data.data.data;
                    $scope.pageCount=data.data.count;
                    $scope.totalPage = Math.ceil(data.data.count/10);
                    var GG = {
                        "kk":function(mm){
                            $scope.getList(mm);
                        }
                    };
                    $("#page").initPage(data.data.count,page,GG.kk);
                }else {
                    $scope.pageCount=0;
                    $scope.totalPage = 0;
                }

            });
        };

        $scope.getList(1);

        $scope.g_selectedChaincode ='';

        // 安装实例
        $scope.showInstallLayer = function(data){
            $scope.g_selectedChaincode =data;
            $scope.chaincodeName = data.ChaincodeName;
            $scope.chaincodeVersion =data.version;
            // REST_SERVICE_GET.getData("api/v1/org/peer","").then(function(data){
            //     console.log(data);
            //     drawTree('peerTree',data);
            // });

            REST_SERVICE_GET.getData("api/v1/org/peer","").then(function(allTree){
                //console.log(allTree)


                console.log($scope.g_selectedChaincode.installPeers);
                if($scope.g_selectedChaincode.installPeers !=null) {
                    var channelTree = $scope.g_selectedChaincode.installPeers.split(",");
                    console.log(channelTree);
                    for (var i = 0; i < allTree.length; i++) {
                        for (var j = 0; j < allTree[i].children.length; j++) {
                            console.log(allTree[i].children[j].name);
                            for (var k = 0; k < channelTree.length; k++) {
                                if (allTree[i].children[j].id == channelTree[k]) {
                                    console.log(channelTree[k] + " get");
                                    allTree[i].children[j]["checked"] = true;
                                    allTree[i].children[j]["chkDisabled"] = true;
                                }
                            }
                        }
                    }
                }
                    console.log(data);
                    drawTree('peerTree',allTree);


            });


            $("#install-layer").show();
            $(".grey-background").show();
        };
        $scope.hideInstallLayer = function(){
            $("#install-layer").hide();
            $(".grey-background").hide();
        };
///home/ucsmy/fabic/balance-transfer-1.0.2/balance-transfer/artifacts/src/user_chaincode\1506330992

        //安装智能合约
        $scope.deployChainCode1 =function () {
            var treeObj = $.fn.zTree.getZTreeObj("peerTree");
            var nodes = treeObj.getCheckedNodes(true);
            console.log(nodes);
            if(nodes.length ==0){
                alert("请选择节点");
                return;
            }
            var peers ='';
            for(var i=0;i<nodes.length;i++){
                peers +=nodes[i].id+",";
            }
            peers=peers.substring(0,peers.length-1);
            console.log(peers);
            REST_SERVICE_POST.getData("api/v1/installChaincode/"+$scope.g_selectedChaincode.pk_id+"/peer/"+peers,"").then(function(data){
                console.log(data);
                if(data.code ==200){
                    $scope.hideInstallLayer();
                    $scope.getList(1);
                }else {
                    alert(data.msg);
                }

            });
        };

        $scope.showChainCode =false;
        // 初始化实例
        $scope.showInitLayer = function(data,type){
            if(type =='init'){
                $scope.showChainCode =false;
                $scope.title = '初始化';
            }else {
                $scope.showChainCode =true;
                $scope.title = '升级';
            }

            $("#init-layer").show();
            $(".grey-background").show();

            $scope.g_selectedChaincode =data;
            $scope.chaincodeName = data.ChaincodeName;
            $scope.chaincodeVersion =data.version;
            $scope.channelName = data.channelName;
        };
        $scope.hideInitLayer = function(){
            $("#init-layer").hide();
            $(".grey-background").hide();
        };

        //提交，初始化或升级
        $scope.commitChaincode = function () {
            if($scope.showChainCode ==true &&$scope.selectChainCode ==''){
                alert("请选择智能合约");
                return;
            }

            var inputVal ='';
            if($scope.checkUserInput($scope.userInput1,1) !=''){
                return;
            }
            for(var i=0;i<$scope.conf.length;i++){
                if($scope.checkUserInput($scope.conf[i],i+2) !=''){
                    return;
                }
                inputVal+=','+$scope.conf[i];
            }
            inputVal = $scope.userInput1+inputVal;

            var url ='';
            if($scope.showChainCode){
                url = 'api/v1/upgradeChaincode/'+$scope.g_selectedChaincode.pk_id+'/newChaincode/'+$scope.selectChainCode+'/param/'+inputVal;
            }else {
                url = "api/v1/initiateChaincode/"+$scope.g_selectedChaincode.pk_id+"/param/"+inputVal+"/policy/"+$scope.endorsePolicy;
            }


            REST_SERVICE_POST.getData(url,"").then(function(data){
                console.log(data);
                if(data.code ==200){
                    $scope.hideInitLayer();
                    $scope.getList(1);
                }else {
                    alert(data.msg);
                }

            });
        };

        $scope.checkUserInput =function (params,index) {
            var reslut ='';
            if(params =="" ||params ==undefined){
                reslut ="参数"+index+"不能为空";
                alert(reslut);
                return reslut;

            }
            if(params.indexOf(',') > -1){
                reslut ="参数"+index+"不能含#号";
                alert(reslut);
                return reslut;
            }
            return reslut;
        };

        // 升级实例
        $scope.showUpdateLayer = function(){
            $("#update-layer").show();
            $(".grey-background").show();
        };
        $scope.hideUpdateLayer = function(){
            $("#update-layer").hide();
            $(".grey-background").hide();
        };


        // 画管道树
        function drawTree(id,data){
            var setting = {
                data: {
                    simpleData: {
                        enable: true,
                        idKey: "id",
                        pIdKey: "pId",
                        rootPId: 0
                    }
                },
                check: {
                    enable: true,
                    chkStyle: "checkbox",
                    chkboxType:{ "Y" : "ps", "N" : "ps" }
                },
                view: {
                    showIcon: false
                }
            };
            var zNodes =data;
            $.fn.zTree.init($("#"+id), setting, zNodes);

        }

        // 初始化增加参数
        $scope.paramsList=[];
        $scope.conf = [];
        $scope.add=function(){
            $scope.paramsList.push({});
            $scope.conf.push('');
        };
        $scope.delete=function(index){
            $scope.paramsList.splice(index,1);
            $scope.conf.splice(index,1);
        };




        // 升级增加参数
        $scope.paramsListUpdate=[];
        $scope.addUpdate=function(){
            $scope.paramsListUpdate.push({});
        };
        $scope.deleteUpdate=function(index){
            $scope.paramsListUpdate.splice(index,1);
        }

        //背书策略费用提示
        $scope.showTipLayer = function () {
            var msg = '费用主要分两部分，一部分是构建区块链环境时使用青云的硬件资源设施费用，这部分费用是给到青云平台的，另一部分费用是使用网金BaaS平台服务的费用。';
            var even = event;
            showTipContent(even,'expense-tip',msg);
        };
        //关闭背书策略费用提示
        $scope.hideDialog=function(id){
            hideDialog(id)
        }

    }
)

App.controller("NETWORK",
    function($scope,REST_SERVICE_GET)
    {
        //console.log("ledgerData.total_peers");
        //console.log(ledgerData);

        //显示数据
        REST_SERVICE_GET.getData("/api/v1/networkpeerData","").then(function(data){
            console.log(data);
            $scope.info={"peers":data};
        });

        $scope.getChannelByPeerId = function (id) {
            var even = event;
            REST_SERVICE_GET.getData("/api/v1/peer/"+id+"/channel","").then(function(data){

                // var string = JSON.stringify(data)
                // string=string.replace("{","[").replace("}","]");
                // console.log(string);
                var obj =[];
                for(var i=0;i<data.length;i++){
                    obj.push([data[i].channelName]);
                }
                 console.log(obj);
                showPipeList(even,'follow-dialog', {th:['管道名'], td:obj});
            });
        };

        






        $scope.g_selectData =[];
        $scope.g_stopGetdata =0;

        $scope.checkVpNode = function () {
            REST_SERVICE_GET.getData("/getPeerStatus","?peerName="+$scope.g_selectData.PeerName).then(function(data){
                console.log(data);
                console.log(data.data[0].Online);
                console.log($scope.g_selectData.Online);
                console.log(data.data[0].PeerName);
                console.log($scope.g_selectData.PeerName);

                if(data.data[0].Online !=$scope.g_selectData.Online && data.data[0].PeerName ==$scope.g_selectData.PeerName){
                    window.clearInterval($scope.g_stopGetdata);
                    $(".loading-layer,.grey-background").hide();
                    $scope.msgTab('deployResult-success');
                }
                // var ledgerData = data.ledgerData;
                // // console.log($scope.g_selectData.online);
                // // console.log($scope.g_selectData.name);
                // for(var i=0;i<ledgerData.length;i++){
                // if(ledgerData[i].name ==$scope.g_selectData.name && ledgerData[i].online !=$scope.g_selectData.online){
                // 	console.log("stop");
                //        window.clearInterval($scope.g_stopGetdata);
                //        $(".loading-layer,.grey-background").hide();
                //        $scope.msgTab('deployResult-success');
                // 	}
                // }

            });
        }

        $scope.vpNodeController = function () {
            $(".alert-layer,.grey-background").hide();
            $(".loading-layer,.grey-background").show();
            var operation ='';
            if($scope.g_selectData.Online){
                operation =false;
                $("#loadingMsg").text("正在停止，请稍后...");
            }else {
                operation =true;
                $("#loadingMsg").text("正在启动，请稍后...");

            }
            REST_SERVICE_GET.getData("/vpNodeController","?peerName="+$scope.g_selectData.PeerName+"&operation="+operation).then(function(data){
                //     console.log(data);
                $(".msgClass").html(data.msg);
                if(data.code ==200){
                    $scope.g_stopGetdata =window.setInterval(function(){$scope.checkVpNode()}, 3000);

                }else {
                    $scope.msgTab('deployResult-fail');
                }
            });
        };

        $('.click-close').click(function(){
            $(".alert-layer,.grey-background").hide();
        });
        // $('.layerOpenClick').click(function(){
        //     $(".alert-layer,.grey-background").show();
        // });

        $scope.msgTab =function (tab) {
            $('#'+tab).fadeIn();
            setTimeout(function(){
                $('#'+tab).fadeOut();
                document.location.reload();
            },2000);
        };

        $scope.controllerBtn = function (data) {
            console.log("data: ");
            console.log(data);
            $scope.g_selectData =data;
            if(data.Online){
                $scope.title ='确定要停止节点'+data.PeerName+'？';
            }else {
                $scope.title ='确定要启动节点'+data.PeerName+'？';
            }
            $("#title").html($scope.title);
            $(".alert-layer,.grey-background").show();
        };

        $scope.$on("handle_broadcast_upd",function(){
            setTimeout(function(){
                $scope.info = ledgerData.peers;
                $scope.$apply();
            },20);

        });

        $scope.showPipeList = function(id, data){
            showPipeList(id, data);
        };
        $scope.hideDialog = function(id){
            hideDialog(id);
        };
    }
);


App.controller("CHANNEL_MANAGER",
    function($scope,REST_SERVICE_GET,REST_SERVICE_POST)
    {
        //console.log("ledgerData.total_peers");
        //console.log(ledgerData);

        //通过 数据库，获取管道列表
        // $scope.datas ='';
        // REST_SERVICE_GET.getData("/api/v1/channel","").then(function(data){
        //     console.log(data);
        //     $scope.datas=data;
        // });

        //获取list和分页
        $scope.getList =function (page) {
            $scope.datas =[];
            REST_SERVICE_GET.getData("/api/v1/channel","?page="+page+"&size=10").then(function(data){
                if(data.data.count !=0){
                    $scope.datas =data.data.data;
                    $scope.pageCount=data.data.count;
                    $scope.totalPage = Math.ceil(data.data.count/10);
                    var GG = {
                        "kk":function(mm){
                            $scope.getList(mm);
                        }
                    };
                    $("#page").initPage(data.data.count,page,GG.kk);
                }else {
                    $scope.pageCount=0;
                    $scope.totalPage = 0;
                }

            });
        };

        $scope.getList(1);



        //根据 管道，获取当前加入节点信息
    $scope.getPeerByChannelId = function (id) {
        console.log(id);
            var even = event;
            REST_SERVICE_GET.getData("/api/v1/channel/"+id+"/peer","").then(function(data){

                var obj =[];
                for(var i=0;i<data.length;i++){
                    obj.push([data[i].PeerName,data[i].Ip,data[i].orgName]);
                }
                console.log(obj);
                showPipeList(even,'follow-dialog', {th:['节点名','地址', '所属组织'], td:obj});
            });
        };

        //根据 管道，获取当前加入组织信息
        $scope.getOrgByChannelId = function (id) {
            console.log(id);
            var even = event;
            REST_SERVICE_GET.getData("/api/v1/channel/"+id+"/org","").then(function(data){

                var obj =[];
                for(var i=0;i<data.length;i++){
                    obj.push([data[i].orgName,data[i].peerCount]);
                }
                console.log(obj);
                showPipeList(even,'follow-dialog', {th:['组织名','节点数'], td:obj});
            });
        };

        //根据 管道，获取当前部署智能合约信息
        $scope.getInstalledChaincodeByChannelId = function (id) {
            console.log(id);
            var even = event;
            REST_SERVICE_GET.getData("/api/v1/channel/"+id+"/installedChaincode","").then(function(data){

                var obj =[];
                for(var i=0;i<data.length;i++){
                    obj.push([data[i].ChaincodeName,data[i].installPeers]);
                }
                console.log(obj);
                showPipeList(even,'follow-dialog', {th:['合约名','已安装合约节点数'], td:obj});
            });
        };


        // 新增管道
        $scope.createPeerInfo = function(){
            $scope.title = "新增管道";
            $scope.channelName ='';
            REST_SERVICE_GET.getData("api/v1/org/peer","").then(function(data){
                console.log(data);
                drawTree('peerTree2',data);
            });
            $(".edit-peer-layer,.grey-background").show();
        };


        // 修改管道
        $scope.editPeerInfo = function(data){
            $scope.title = "修改管道";
            $scope.channelName=data.channelname;
            REST_SERVICE_GET.getData("api/v1/org/peer","").then(function(allTree){
                //console.log(allTree);
                for(var i=0;i<allTree.length;i++){
                    for(var j=0;j<allTree[i].children.length;j++){
                        console.log(allTree[i].children[j].name);
                    }
                }

                REST_SERVICE_GET.getData("api/v1/channel/"+data.pk_id+"/peer","").then(function(channelTree){
                    console.log(channelTree);
                    for(var i=0;i<allTree.length;i++){
                        for(var j=0;j<allTree[i].children.length;j++){
                            console.log(allTree[i].children[j].name);
                            for(var k=0;k<channelTree.length;k++){
                                if(allTree[i].children[j].id ==channelTree[k].peerId){
                                    console.log(channelTree[k].PeerName+" get");
                                    allTree[i].children[j]["checked"]=true;
                                    allTree[i].children[j]["chkDisabled"]=true;
                                }
                            }
                        }
                    }
                    console.log(allTree);
                    drawTree('peerTree2',allTree);

                });
            });
            $(".edit-peer-layer,.grey-background").show();
        };
        $scope.closeEditPeerLayer = function(){
            $(".edit-peer-layer,.grey-background").hide();
        };

        $scope.showPipeList = function(id, data){
            showPipeList(id, data);
        };
        $scope.hideDialog = function(id){
            hideDialog(id);
        }

        $scope.getTreeData =function () {
            REST_SERVICE_GET.getData("api/v1/org/peer","").then(function(data){
                console.log(data);
                drawTree('peerTree2',data);
            });
        };


        $scope.createChannel =function () {

            if($scope.channelName ==undefined ||$scope.channelName ==''){
                alert("请输入管道名称");
                return;
            }

            var treeObj = $.fn.zTree.getZTreeObj("peerTree2");
            var nodes = treeObj.getCheckedNodes(true);
            console.log(nodes);
            if(nodes.length ==0){
                alert("请选择节点");
                return;
            }
            var peers ='';
            for(var i=0;i<nodes.length;i++){
                peers +=nodes[i].id+",";
            }
            peers=peers.substring(0,peers.length-1);
            console.log(peers);
            REST_SERVICE_POST.getData("api/v1/newChannel/"+$scope.channelName+"/peer/"+peers,"").then(function(data){
                console.log(data);
                if(data.code ==200){
                    $scope.closeEditPeerLayer();
                    $scope.getList(1);
                }

            });

        };

        // 画管道树
        function drawTree(id,data){
            var setting = {
                data: {
                    simpleData: {
                        enable: true,
                        idKey: "id",
                        pIdKey: "pId",
                        rootPId: 0
                    }
                },
                check: {
                    enable: true,
                    chkStyle: "checkbox",
                    chkboxType:{ "Y" : "ps", "N" : "ps" }
                },
                view: {
                    showIcon: false
                }
            };
            var zNodes =data;
            $.fn.zTree.init($("#"+id), setting, zNodes);

        }




    }
);

// 跟随弹层
App.directive("dialog", function(){
    return {
        restrict: "E",
        replace: true,
        template: function(element, attrs){
            return '<div class="ucs-dialog">'+
                '<div class="dialog-title">'+
                '<p>'+ attrs.dialogtitle +'<span class="little-title">'+ (attrs.littletitle || '') +'</span></p>'+
                '<a href="javascript:;" class="dialog-close-btn fa fa-close" ng-click="hideDialog(\''+ attrs.id +'\')"></a>'+
                '</div>'+
                '<div class="dialog-content">'+
                '<div class="peer-list-wrap">'+
                '<table cellspacing="0" cellpadding="0" class="J_peerList peer-list">'+
                '</table>'+
                '</div>'+
                '</div>'+
                '<div class="dialog-tip"></div>'+
                '<div class="dialog-tip-cover"></div>'+
                '</div>';
        }
    }
});

//提示浮层
App.directive("tip", function(){
    return {
        restrict: "E",
        replace: true,
        template: function(element, attrs){
            return '<div class="ucs-tip">'+
                '<div class="tip-title">'+
                '<a href="javascript:;" class="tip-close-btn fa fa-close" ng-click="hideDialog(\''+ attrs.id +'\')"></a>'+
                '</div>'+
                '<div class="tip-content">'+
                '<div class="tip-detail-wrap">'+
                '<div class="tip-detail"></div>'+
                '</div>'+
                '</div>'+
                '<div class="tip-point"></div>'+
                '<div class="tip-point-cover"></div>'+
                '</div>';
        }
    }
});



// directive for dependency injection, creates html element that gets injected into index.html with charts
App.directive("barsChart", function ($parse) {
    var object = {
        restrict: "E",
        replace: false,
        scope: {data: "=chartData"},
        link: function (scope, element, attrs) {
            var chart = d3.select(element[0]);
            chart.append("div").attr("class", "chart")
                .selectAll("div")
                .data(scope.data).enter().append("div")
                .transition().ease("elastic")
                .style("width", function(d) { return d + "%"; })
                .text(function(d) { return d; })
        }
    };
    return object;
});

App.controller("GRAPH",
    function($scope){

        $scope.checkTime = statsData.checkTime;
        $scope.avgTxnLatency = statsData.avgTxnLatency;
        $scope.txnRate = statsData.txnRate;
        $scope.mineRate = statsData.mineRate;


        $scope.$on("stats_broadcast_upd",function(){
            setTimeout(function(){
                $scope.checkTime = statsData.checkTime;
                if($scope.avgTxnLatency < statsData.avgTxnLatency)
                    $scope.avgTxnLatencySc = 1;
                else if($scope.avgTxnLatency > statsData.avgTxnLatency)
                    $scope.avgTxnLatencySc = -1;
                else
                    $scope.avgTxnLatencySc = 0;
                $scope.avgTxnLatency = statsData.avgTxnLatency;

                if($scope.txnRate < statsData.txnRate)
                    $scope.txnRateSc = 1;
                else if($scope.txnRate > statsData.txnRate)
                    $scope.txnRateSc = -1;
                else
                    $scope.txnRateSc = 0;
                $scope.txnRate = statsData.txnRate;

                if($scope.mineRate < statsData.mineRate)
                    $scope.mineRateSc = 1;
                else if($scope.mineRate > statsData.mineRate)
                    $scope.mineRateSc = -1;
                else
                    $scope.mineRateSc = 0;
                $scope.mineRate = statsData.mineRate;
                $scope.$apply();
            },10);

        });
    }
);

App.controller("TX_RATE_NEW",

    function($scope) {

        var dataChg= true;
        $scope.$on("stats_broadcast_upd",function(){
            setTimeout(function(){
                if($scope.chart.data && statsData.txRateGraph) {
                    $scope.chart.data.datasets[0].data = statsData.txRateGraph.txRate;
                    $scope.chart.data.labels = statsData.txRateGraph.time;
                    $scope.chart.update();
                }

            },20);
        });

        var data = {
            labels: statsData.txRateGraph.time,
            datasets: [
                {
                    label: "Transaction Rate by time",
                    fill: false,
                    lineTension: 0.1,
                    backgroundColor: "rgba(75,192,192,1)",
                    borderColor: "rgba(75,192,192,1)",
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: "rgba(75,192,192,1)",
                    pointBackgroundColor: "#fff",
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "rgba(75,192,192,1)",
                    pointHoverBorderColor: "rgba(220,220,220,1)",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    data: statsData.txRateGraph.txRate,
                    spanGaps: false,
                }
            ]
        };

        $scope.ctx = $("#tx_rate");
        var line_txrate = echarts.init(document.getElementById('tx_rate'));
        var line_txrate_Option = {
            legend: {
                data: ['按时间的交易速度'],
                right: '10px'
            },
            color: ['#2593ef'],
            grid: {
                left: '40px',
                right: '20px',
                top: '40px',
                bottom: '30px'
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: data.labels
            },
            yAxis: {
                type: 'value',

                axisLabel: {

                }
            },
            series: [
                {
                    name: '按时间的交易速度',
                    type: 'line',
                    data: data.datasets[0].data
                }
            ]
        };
        line_txrate.setOption(line_txrate_Option);
    }
)


App.controller("TX_RATE",

    function($scope) {

        var dataChg= true;
        $scope.$on("stats_broadcast_upd",function(){
            setTimeout(function(){
                if($scope.chart.data && statsData.txRateGraph) {
                    $scope.chart.data.datasets[0].data = statsData.txRateGraph.txRate;
                    $scope.chart.data.labels = statsData.txRateGraph.time;
                    $scope.chart.update();
                }

            },20);
        });

        var data = {
            labels: statsData.txRateGraph.time,
            datasets: [
                {
                    label: "Transaction Rate by time",
                    fill: false,
                    lineTension: 0.1,
                    backgroundColor: "rgba(75,192,192,1)",
                    borderColor: "rgba(75,192,192,1)",
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: "rgba(75,192,192,1)",
                    pointBackgroundColor: "#fff",
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "rgba(75,192,192,1)",
                    pointHoverBorderColor: "rgba(220,220,220,1)",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    data: statsData.txRateGraph.txRate,
                    spanGaps: false,
                }
            ]
        };

        $scope.ctx = $("#tx_rate");

        $scope.chart = new Chart($scope.ctx , {
            type: 'line',
            data: data,
            options: {
                animation: false,
                scales: {
                    yAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Rate',
                            ticks: 1
                        },
                        ticks: {
                            min: 0,
                            stepSize: 1,
                        }
                    }],

                    xAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Time(HH:MM:SS)'
                        },
                        ticks: {
                            min: 0,
                            stepSize: 1,
                        }
                    }],
                }
            }
        });
    }
)

App.controller("BLK_RATE_NEW",

    function($scope) {
        $scope.$on("stats_broadcast_upd",function(){
            setTimeout(function(){
                if($scope.chart.data && statsData.blkRateGraph) {
                    $scope.chart.data.datasets[0].data = statsData.blkRateGraph.blkRate;
                    $scope.chart.data.labels = statsData.blkRateGraph.time;
                    $scope.chart.update();
                }

            },30);
        });

        var data = {
            labels: statsData.blkRateGraph.time,
            datasets: [
                {
                    label: "Block Rate by time",
                    data: statsData.blkRateGraph.blkRate,
                    fill: false,
                    lineTension: 0.1,
                    backgroundColor: "yellow", //fille color top icon
                    borderColor: "yellow", //line color
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: "yellow",
                    pointBackgroundColor: "yellow",
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "orange",
                    pointHoverBorderColor: "rgba(220,220,220,1)",
                    scaleFontColor: "white",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    spanGaps: false
                }
            ]
        };

        $scope.ctx = $("#blk_rate");
        var line2 = echarts.init(document.getElementById('blk_rate'));
        var line2Option = {
            legend: {
                data: ['按时间的出块速度'],
                right: '10px'
            },
            color: ['#2593ef'],
            grid: {
                left: '40px',
                right: '20px',
                top: '40px',
                bottom: '30px'
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: data.labels
            },
            yAxis: {
                type: 'value',

                axisLabel: {

                }
            },
            series: [
                {
                    name: '按时间的出块速度',
                    type: 'line',
                    data: data.datasets[0].data
                }
            ]
        };
        line2.setOption(line2Option);


    }
)

App.controller("BLK_RATE",

    function($scope) {
        $scope.$on("stats_broadcast_upd",function(){
            setTimeout(function(){
                if($scope.chart.data && statsData.blkRateGraph) {
                    $scope.chart.data.datasets[0].data = statsData.blkRateGraph.blkRate;
                    $scope.chart.data.labels = statsData.blkRateGraph.time;
                    $scope.chart.update();
                }

            },30);
        });

        var data = {
            labels: statsData.blkRateGraph.time,
            datasets: [
                {
                    label: "Block Rate by time",
                    data: statsData.blkRateGraph.blkRate,
                    fill: false,
                    lineTension: 0.1,
                    backgroundColor: "yellow", //fille color top icon
                    borderColor: "yellow", //line color
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: "yellow",
                    pointBackgroundColor: "yellow",
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "orange",
                    pointHoverBorderColor: "rgba(220,220,220,1)",
                    scaleFontColor: "white",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    spanGaps: false
                }
            ]
        };

        $scope.ctx = $("#blk_rate");
        $scope.chart = new Chart($scope.ctx, {
            type: 'line',
            data: data,
            options: {
                animation: false,
                scales: {
                    yAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Rate',
                            ticks: 1
                        },
                        ticks: {
                            min: 0,
                            stepSize: 1,
                        }
                    }],

                    xAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Time(HH:MM:SS)'
                        },
                        ticks: {
                            min: 0,
                            stepSize: 1,
                        }
                    }],
                }
            }
        })


    }
)

App.controller("BLK_TX_NEW",

    function($scope) {
        $scope.$on("stats_broadcast_upd",function(){
            if($scope.chart.data && statsData.blkTxGraph) {


                setInterval(function() {
                        data.labels = statsData.blkTxGraph.block;
                        $scope.chart.data.datasets[0].data = statsData.blkTxGraph.txs;
                        $scope.chart.update();
                    },40
                );
            }
        });

        var data = {
            labels: statsData.blkTxGraph.block,
            datasets: [
                {
                    label: "Transactions per block",
                    data: statsData.blkTxGraph.txs,
                    fill: false,
                    lineTension: 5,
                    backgroundColor: "#00ff00", //fille color top icon
                    borderColor: "#00ff00", //line color
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: "yellow",
                    pointBackgroundColor: "grey",
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "orange",
                    pointHoverBorderColor: "rgba(220,220,220,1)",
                    scaleFontColor: "white",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    spanGaps: true
                }
            ]
        };

        $scope.ctx = $("#blk_tx");
        var bar=echarts.init(document.getElementById('blk_tx'));
        var barOption={
            legend: {
                data: ['每个区块的交易数量'],
                right: '10px'
            },
            color: ['#3c9bf0'],
            tooltip : {
                trigger: 'axis',
                axisPointer : {
                    type : 'shadow'
                }
            },
            grid: {
                left: '40px',
                right: '20px',
                top: '40px',
                bottom: '30px'
            },
            xAxis : [
                {
                    type : 'category',
                    data : data.labels,
                    axisTick: {
                        alignWithLabel: true
                    }
                }
            ],
            yAxis : [
                {
                    type : 'value'
                }
            ],
            series : [
                {
                    name:'每个区块的交易数量',
                    type:'bar',
                    barWidth: '60%',
                    data:data.datasets[0].data
                }
            ]
        };
        bar.setOption(barOption);


    }
)

App.controller("BLK_TX",

    function($scope) {
        $scope.$on("stats_broadcast_upd",function(){
            if($scope.chart.data && statsData.blkTxGraph) {


                setInterval(function() {
                        data.labels = statsData.blkTxGraph.block;
                        $scope.chart.data.datasets[0].data = statsData.blkTxGraph.txs;
                        $scope.chart.update();
                    },40
                );
            }
        });

        var data = {
            labels: statsData.blkTxGraph.block,
            datasets: [
                {
                    label: "Transactions per block",
                    data: statsData.blkTxGraph.txs,
                    fill: false,
                    lineTension: 5,
                    backgroundColor: "#00ff00", //fille color top icon
                    borderColor: "#00ff00", //line color
                    borderCapStyle: 'butt',
                    borderDash: [],
                    borderDashOffset: 0.0,
                    borderJoinStyle: 'miter',
                    pointBorderColor: "yellow",
                    pointBackgroundColor: "grey",
                    pointBorderWidth: 1,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "orange",
                    pointHoverBorderColor: "rgba(220,220,220,1)",
                    scaleFontColor: "white",
                    pointHoverBorderWidth: 2,
                    pointRadius: 1,
                    pointHitRadius: 10,
                    spanGaps: true
                }
            ]
        };

        $scope.ctx = $("#blk_tx");
        $scope.chart = new Chart($scope.ctx , {
            type: 'bar',
            data: data,
            options: {
                animation: false,
                scales: {
                    yAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Transactions'
                        },
                        ticks: {
                            min: 0,
                            stepSize: 1,
                        }
                    }],

                    xAxes: [{
                        scaleLabel: {
                            display: true,
                            labelString: 'Block'
                        },
                        ticks: {
                            min: 0,
                            stepSize: 1,
                        }
                    }],
                }
            }
        })


    }
)


App.controller("APPR_TX",

    function($scope) {
        $scope.$on("stats_broadcast_upd",function(){
            if($scope.chart.data && statsData.apprTx) {

                setInterval(function() {
                        $scope.chart.data.labels = statsData.apprTx.stats;
                        //console.log(' APPR TX OLD [',$scope.chart.data.datasets[0].data ,']  New [ ' + statsData.apprTx.counts,' ] ')
                        $scope.chart.data.datasets[0].data = statsData.apprTx.counts;

                        $scope.chart.update();
                    },50
                );
            }
        });

        var data = {
            labels: statsData.apprTx.stats,
            datasets: [
                {
                    data: statsData.apprTx.counts,
                    backgroundColor: [
                        randomColor(),
                        randomColor(),
                        randomColor()
                    ],
                    hoverBackgroundColor: [
                        randomColor(),
                        randomColor(),
                        randomColor()
                    ]
                }]
        };

        $scope.ctx = $("#appr_tx");
        $scope.chart = new Chart($scope.ctx , {
            type: 'pie',
            data: data,
            options: {
                animation: false,
                //legend:false
            }
        })
    }
)


App.controller("CH_TX",

    function($scope) {
        $scope.$on("stats_broadcast_upd",function(){
            if($scope.chart.data && statsData.chTx) {

                setInterval(function() {
                        $scope.chart.data.labels = statsData.chTx.chainCodes;
                        $scope.chart.data.datasets[0].data = statsData.chTx.counts;
                        bgColors = new Array();
                        hoverColors = new Array();
                        for(var i  = 0; i < statsData.chTx.chainCodes.length; i++) {
                            bgColors.push(randomColor());
                            hoverColors.push(randomColor());
                        }
                        $scope.chart.data.datasets.backgroundColor = bgColors;
                        $scope.chart.data.datasets.hoverBackgroundColor = hoverColors;
                        $scope.chart.update();
                    },60
                );
            }
        });

        var bgColors = new Array();
        var hoverColors = new Array();
        for(var i  = 0; i < statsData.chTx.chainCodes.length; i++) {
            bgColors.push(randomColor());
            hoverColors.push(randomColor());
        }

        var data = {
            labels: statsData.chTx.chainCodes,
            datasets: [
                {
                    data: statsData.chTx.counts,
                    backgroundColor: bgColors,
                    hoverBackgroundColor: hoverColors
                }]
        };

        $scope.ctx = $("#ch_tx");
        $scope.chart = new Chart($scope.ctx , {
            type: 'pie',
            data: data,
            options: {
                animation: false,
                //legend:false
            }
        })
    }
)

App.controller("TRIGGER",
    function($scope){
        // collapse and expand navigation menu in mobile/smaller resolution view
        // $scope.activate = function(){
        // 	x = document.getElementById("navigation").style.display;
        // 		if(x =="none"){
        // 			document.getElementById("navigation").style.display = "block";
        // 		} else {
        // 			document.getElementById("navigation").style.display = "none";
        // 		}
        // 	}
    }
)

App.controller("BLOCKS",
    function($scope, SERVICE_BLOCK, SERVICE_HEIGHT,SHARE_INFORMATION,REST_SERVICE_GET){
        // Used to update which block or transaction information should display once user chooses view or expand button from table
        $scope.selected = 0;
        $scope.initial = 0;
        $scope.info= [];
        $scope.infoc= {};
        $scope.showLayer = false;

        $scope.loader= {
            loading: true,
        };
        $scope.hideloader = function(){
            $scope.loader.loading = false;
        }

        //获取数据库channel
        $scope.Channel = "";
        REST_SERVICE_GET.getData("/api/v1/channelName","").then(function(data){
            if(data.length ==0){
                alert("请先创建channel");
                window.location.href ="/channelManager";
                return;
            }
            $scope.Channel =data;
            //获取当前的Channel
            REST_SERVICE_GET.getData("/getCurrentChannel","").then(function(data){
                console.log(data);
                if(data.code ==100){
                    alert("请先创建channel")
                }else {
                    $scope.selectChannel = data.data;
                }


            });

        });

        $scope.changeChannel = function(x){
            console.log(x);
            //更改channel
            REST_SERVICE_GET.getData("/changeChannel?channelName=",x).then(function(data){

            });
        };


        $scope.update = function(height){

            if(ledgerData.blocks.length > 11)
                $scope.number_of_blocks_to_display = 11;
            else
                $scope.number_of_blocks_to_display = height;

            var array_location = 0; // array location server response must be stored at
            var count = 0; // number of responses returned from server
            var len = $scope.info.length;
            $scope.info2= [];
            $scope.trans2 = [];
            //for(var chain_index = height; chain_index>(height-len) && chain_index > 0; chain_index--){
            for(var chain_index = 0; chain_index <= height; chain_index++){
                var data = ledgerData.blocks[height - chain_index];
                //console.log(data);
                if(!data ) {//|| !data.nonHashData
                    continue;
                }
                //var date = new Date(null);
                //date.setSeconds(data.nonHashData.localLedgerCommitTimestamp.seconds);
                //date.toISOString().substr(11, 8);
                //data.nonHashData.localLedgerCommitTimestamp.date = date;
                // using the array index that we passed in previously and added as metadata, we use it to store it in the correct array index, avoids sorting when mulitple requests happen asynchronously
                data.location = count;
                data.block_origin = height - chain_index;

                $scope.info2[data.location] = data;

				/*
				 console.log("data.currentBlockHash");
				 console.log(data.currentBlockHash);
				 data.currentBlockHash.description = "123123"
				 */

                if( data.transactions && data.transactions.length ) {
                    for(var k=0; k<data.transactions.length; k++){
                        var date2 = new Date(null);
                        date2.setSeconds(data.transactions[k].timestamp.seconds);
                        data.transactions[k].date = date2;
                        data.transactions[k].origin = data.block_origin;
                        $scope.trans2.push(data.transactions[k]);
                    }
                }

                count++;

                // once all 10 GET requests are recieved and correctly stored inorder in array, we turn off loading symbol, and proceed to get all transactions from recieved blocks
                if(count == $scope.number_of_blocks_to_display || chain_index+1 == height){
                    $scope.hideloader();

                    $scope.trans = [];
                    for(var i=0; i<$scope.trans2.length; i++){
                        $scope.trans = $scope.trans.concat($scope.trans2[i]);
                    }
                    // after all the block information is ready, $scope.range is initialized which is used in ng-repeat to itterate through all blocks, initialzed now to maintain smooth animation
                    $scope.range = [0,1,2,3,4,5,6,7,8,9,10];
                    setTimeout(function() { $scope.info = $scope.info2; $scope.$apply(); }, 40);
                    // once all the transactions are loaded, then we broadcast the information to the Transaction controller that will use it to display the information
                    setTimeout(function() {SHARE_INFORMATION.load_broadcast_transactions($scope.trans); }, 60);
                }
                array_location++;
            }

        }

        // array used to keep track of 10 most recent blocks, if more than 10 would like to be dislpayed at a time, change $scope.number_of_block_to_display and $scope.range in $scope.update()
        if(ledgerData.blocks.length > 10)
            $scope.number_of_blocks_to_display = 10;
        else
            $scope.number_of_blocks_to_display = ledgerData.length;
        $scope.info = new Array($scope.number_of_blocks_to_display);

        // will be used to keep track of most recent transactions, initially array of objects with transcations from each block, in the end concated to $scope.trans with a single transaction at each index
        $scope.trans2 = new Array($scope.number_of_blocks_to_display);

        // broadcast reciever get chain information from CURRENT controller that initially calls http request, once height is known, specific blocks begin to be retrieved in $scope.update()
        $scope.$on("handle_broadcast",function(){
            $scope.size = SHARE_INFORMATION.chain.height.low;
            // if 0, then it's the initial startup of the controller, only run at the beggining once to get information
            if($scope.initial == 0){
                $scope.initial++;
                $scope.update($scope.size-1);
            }
        });
        $scope.$on("handle_broadcast_upd",function(){
            $scope.size = SHARE_INFORMATION.chain.height.low;
            $scope.update($scope.size-1);
        });

        // updates selected block number and displays form with transaction info based on selection
        $scope.Update_selected_block = function(idx){
            //$scope.selected = x;
            $scope.infoc = angular.copy($scope.info[idx]);
            $scope.infoc.blockNum  = $scope.size - idx -1;
            // document.forms["change2"].submit();
            $scope.showLayer = true;
        }
        $scope.closeLayer = function () {
            $scope.showLayer = false;
        }
        if(!$scope.info) {
            $scope.info = [];
        }

    }
)

App.controller("TRANSACTIONS",
    function(SHARE_INFORMATION, $scope,REST_SERVICE_GET){

        //获取数据库channel
        $scope.Channel = "";
        REST_SERVICE_GET.getData("/api/v1/channelName","").then(function(data){
            if(data.length ==0){
                alert("请先创建channel");
                window.location.href ="/channelManager";
                return;
            }
            $scope.Channel =data;
            //获取当前的Channel
            REST_SERVICE_GET.getData("/getCurrentChannel","").then(function(data){
                console.log(data);
                if(data.code ==100){
                    alert("请先创建channel")
                }else {
                    $scope.selectChannel = data.data;
                }


            });

        });

        $scope.changeChannel = function(x){
            console.log(x);
            //更改channel
            REST_SERVICE_GET.getData("/changeChannel?channelName=",x).then(function(data){
                //更改管道先清空$scope.trans
                ledgerData.blocks=[];
            });
        };



        $scope.showLayer = false;
        // controls number of rows to display in the table, initially set to 10
        $scope.row_amount2 = 10;

		/* used to display form with extra transaction information, onclick, transaction_selected is set to the $index of the table row, the displayed form knows
		 which transaction information to display getElementById looking at this number*/
        $scope.transaction_selected = 0;

        // loading icon, is displayed while data is loading
        $scope.loader= {
            loading: true,
        };
        $scope.hideloader = function(){
            $scope.loader.loading = false;
        }

        // handle recieving information from the BLOCKS controller that initally calls the http requests
        $scope.$on("handle_broadcast",function(){
            console.log("handle_broadcast");
            $scope.trans = ledgerData.blocks;
            $scope.hideloader();
            $scope.$apply()
        });

        $scope.$on("handle_broadcast_upd",function(){
            console.log("handle_broadcast_upd");
            $scope.trans = ledgerData.blocks;
            $scope.hideloader();
            $scope.$apply()
        });

        // update seleted2 index and update form with corresponding transaction info
        $scope.Update_transaction_selection_index = function(x, y){
            $scope.transs = angular.copy($scope.trans[x].data.data[y]);
            $scope.showLayer = true;
            // document.forms["change3"].submit();
        }
        $scope.closeLayer = function () {
            $scope.showLayer = false;
        }
    })
// used to keep navigation menu displayed horizontally when resolution change from menu button to navigation bar, runs whenever window resizes
// function restore() {
// 	var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
// 	if(width > 600 ){
// 		document.getElementById("navigation").style.display = "block";
// 	} else {
// 		document.getElementById("navigation").style.display = "none";
// 	}
// }
//Global chart config
Chart.defaults.global.defaultFontColor = '#fff';

function randomColor() {
    return'rgb(' + (Math.floor(Math.random() * 256)) + ',' + (Math.floor(Math.random() * 256)) + ',' + (Math.floor(Math.random() * 256)) + ')';
}

function getdate(seconds) {
    var now = new Date(null);
    now.setSeconds(seconds);
    y = now.getFullYear();
    m = now.getMonth() + 1;
    d = now.getDate();
    return y + "-" + (m < 10 ? "0" + m : m) + "-" + (d < 10 ? "0" + d : d) + " " + now.toTimeString().substr(0, 8);
}

// function getTable(data) {
//     var th = data.th;
//     var td = data.td;
//     console.log(td);
//     var result = '';
//
//     result += '<tr>';
//     for(var i = 0; i< th.length; i++){
//         result += '<th>'+ th[i] +'</th>';
//     }
//     result += '</tr>';
//     console.log(td.length);
//     for(var i = 0; i< td.length; i++){
//         var item = td[i];
//         result += '<tr>';
//         console.log(item);
//        // for(var j = 0; j < item.length; j++){
//             result += '<td>'+ item.channelName +'</td>';
//      //   }
//         result += '</tr>';
//     }
//
//     return result;
//
// };

function getTable(data) {
    var th = data.th;
    var td = data.td;
    var result = '';

    result += '<tr>';
    for(var i = 0; i< th.length; i++){
        result += '<th>'+ th[i] +'</th>';
    }
    result += '</tr>';
    for(var i = 0; i< td.length; i++){
        var item = td[i];
        result += '<tr>';
        for(var j = 0; j < item.length; j++){
            result += '<td>'+ item[j] +'</td>';
        }
        result += '</tr>';
    }

    return result;

};

// 显示跟随弹层内容
function showPipeList(event,id, data) {
    console.log("event.pageX = "+event.pageX);
    var positionX = event.pageX || 0;
    var positionY = event.pageY || 0;
    var $dialog = $("#"+id);
    $dialog.css({
        left: (positionX-23) +'px',
        top: (positionY+20) +'px',
    });

    $dialog.find('.J_peerList').html(getTable(data));

    $dialog.show();
};

// 关闭跟随弹层/关闭提示浮层
function hideDialog(id) {
    $("#"+id).hide();
};

// 显示提示浮层
function showTipContent(event,id, msg) {
    console.log("event.pageX = "+event.pageX);
    var positionX = event.pageX || 0;
    var positionY = event.pageY || 0;
    var $dialog = $("#"+id);
    $dialog.css({
        left: (positionX-23) +'px',
        top: (positionY+20) +'px'
    });

    $dialog.find('.tip-detail').html(msg);

    $dialog.show();
};