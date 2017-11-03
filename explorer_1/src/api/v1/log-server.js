/**
 * Created by ucs_yangqihua on 2017/9/12.
 */

var mysql = require('../../../hyperledgerpeerintf/mysqlUnit');
var getLogList = function(req, res, next) {
    var querySql =' 1=1 ';
    if(checkParams(req.query.startDate)){
        querySql +="and createTime >= '"+req.query.startDate+"'";
    }
    if(checkParams(req.query.endDate)){
        querySql +="and createTime <= '"+req.query.endDate+"'";
    }
    if(checkParams(req.query.operation)){
        querySql +="and operation='"+req.query.operation+"'";
    }
    if(checkParams(req.query.transactionId)){
        querySql +="and transactionId ='"+req.query.transactionId+"'";
    }
    if(checkParams(req.query.chaincodeId)){
        querySql +="and chaincodeId like '%"+req.query.chaincodeId+"%'";
    }
    if(checkParams(req.query.channelId)){
        querySql +="and channelId = '"+req.query.channelId+"'";
    }
    if(checkParams(req.query.params)){
        querySql +="and params like  '%"+req.query.params+"%'";
    }
    console.log("***********getLogList querySql:"+querySql);

    if(req.query.page <1){
        return res.send(new RetMsg("100","页数不能小于1",""));
    }
    var size = parseInt(req.query.size);
    var pageStart =(req.query.page-1)*size;
    var count =0;
    mysql.query("select count(*) as count from log where "+querySql,"",function(err,results,fields){
        count = results[0].count;
        mysql.query("select * from log where "+querySql+" order by pk_Id desc limit ?,? ",[pageStart,size],function(err,results,fields){
            //  var obj = JSON.parse(JSON.stringify(results));
            var data={"count":count,"data":results};
            return res.send(new RetMsg("200","查询成功",data));

        });
    });

};
exports.getLogList = getLogList;


function checkParams(params) {
    if(params ==undefined || params ==''){
        return false;
    }else {
        return true;
    }
}

function RetMsg(code,msg,data) {
    this.code = code;
    this.msg = msg;
    this.data = data;
}