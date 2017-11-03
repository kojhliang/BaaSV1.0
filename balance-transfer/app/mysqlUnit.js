/**
 * Created by ucs_yangqihua on 2017/7/20.
 */

var mysql = require('mysql');
// var pool = mysql.createPool({
// 	host: '172.17.21.59',
//     user: 'root',
// 	password: 'root',
//     database: 'explorer_test',
//     port: '3306'
// });
var pool =null;
function mysqlUnit(){

}

mysqlUnit.prototype.query=function(sql,params,callback){
    //如果还没初始化成功，则再初始话一次
    if(pool==null){
        // pool = mysql.createPool({
        //     host: '172.17.21.59',
        //     user: 'root',
        //     password: 'root',
        //     database: 'explorer_test',
        //     port: '3306'
        // });
        pool = mysql.createPool({
            host: '172.17.16.74',
            user: 'root',
            password: 'kojh',
            database: 'explorer_lmh',
            port: '3306'
        });
        console.log("****pool:");
        console.log(pool);
        var start = new Date().getTime();
        while (true)  if (new Date().getTime() - start > 3000) break;
        pool.getConnection(function(err,conn){
            if(err){
                console.log("****getConnection error:"+err);
                callback(err,null,null);
            }else{
                var query =conn.query(sql,params,function(qerr,results,fields){
                    console.log("****execute sql:"+query.sql);
                    console.log("****error:"+qerr);
                    console.log("****results:");
                    console.log(results);
                    //释放连接
                    conn.release();
                    //事件驱动回调
                    callback(qerr,results,fields);
                });
                console.log(query.sql);
            }
        });
    }else{
        pool.getConnection(function(err,conn){
            if(err){
                console.log("****getConnection error:"+err);
                callback(err,null,null);
            }else{
                var query =conn.query(sql,params,function(qerr,results,fields){
                    console.log("****execute sql:"+query.sql);
                    console.log("****error:"+qerr);
                    console.log("****results:");
                    console.log(results);
                    //释放连接
                    conn.release();
                    //事件驱动回调
                    callback(qerr,results,fields);
                });
                console.log(query.sql);
            }
        });
    }

};


module.exports = new mysqlUnit();