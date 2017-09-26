/**
 * Created by ucs_yangqihua on 2017/7/20.
 */

var mysql = require('mysql');
var pool = mysql.createPool({
	host: '172.17.21.59',
    user: 'root',
	password: 'root',
    database: 'explorer_test',
    port: '3306'
});
function mysqlUnit(){

}

mysqlUnit.prototype.query=function(sql,params,callback){
    pool.getConnection(function(err,conn){
        if(err){
            callback(err,null,null);
        }else{
            var query =conn.query(sql,params,function(qerr,results,fields){
                //释放连接
                conn.release();
                //事件驱动回调
                callback(qerr,results,fields);
            });
            console.log(query.sql);
        }
    });
};


module.exports = new mysqlUnit();