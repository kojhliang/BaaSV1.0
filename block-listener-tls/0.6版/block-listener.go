/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

package main

import (
	"database/sql"
	"flag"
	"fmt"
	_ "github.com/go-sql-driver/mysql"
	"strconv"
	"strings"
	"time"
	//"unicode/utf8"
	//"github.com/golang/protobuf/proto"
	"os"

	"github.com/hyperledger/fabric/events/consumer"
	pb "github.com/hyperledger/fabric/protos"
)

var (
	dbhostsip  = "127.0.0.1:3306" //IP地址
	dbusername = "root"           //用户名
	dbpassword = "123456"         //密码
	dbname     = "Test"           //表名
)

type adapter struct {
	notfy              chan *pb.Event_Block
	rejected           chan *pb.Event_Rejection
	cEvent             chan *pb.Event_ChaincodeEvent
	listenToRejections bool
	chaincodeID        string
}

//GetInterestedEvents implements consumer.EventAdapter interface for registering interested events
func (a *adapter) GetInterestedEvents() ([]*pb.Interest, error) {
	if a.chaincodeID != "" {
		return []*pb.Interest{
			{EventType: pb.EventType_BLOCK},
			{EventType: pb.EventType_REJECTION},
			{EventType: pb.EventType_CHAINCODE,
				RegInfo: &pb.Interest_ChaincodeRegInfo{
					ChaincodeRegInfo: &pb.ChaincodeReg{
						ChaincodeID: a.chaincodeID,
						EventName:   ""}}}}, nil
	}
	return []*pb.Interest{{EventType: pb.EventType_BLOCK}, {EventType: pb.EventType_REJECTION}}, nil
}

//Recv implements consumer.EventAdapter interface for receiving events
func (a *adapter) Recv(msg *pb.Event) (bool, error) {
	if o, e := msg.Event.(*pb.Event_Block); e {
		a.notfy <- o
		return true, nil
	}
	if o, e := msg.Event.(*pb.Event_Rejection); e {
		if a.listenToRejections {
			a.rejected <- o
		}
		return true, nil
	}
	if o, e := msg.Event.(*pb.Event_ChaincodeEvent); e {
		a.cEvent <- o
		return true, nil
	}
	return false, fmt.Errorf("Receive unkown type event: %v", msg)
}

//Disconnected implements consumer.EventAdapter interface for disconnecting
func (a *adapter) Disconnected(err error) {
	fmt.Printf("Disconnected...exiting\n")
	os.Exit(1)
}

func createEventClient(eventAddress string, listenToRejections bool, cid string) *adapter {
	var obcEHClient *consumer.EventsClient

	done := make(chan *pb.Event_Block)
	reject := make(chan *pb.Event_Rejection)
	adapter := &adapter{notfy: done, rejected: reject, listenToRejections: listenToRejections, chaincodeID: cid, cEvent: make(chan *pb.Event_ChaincodeEvent)}
	obcEHClient, _ = consumer.NewEventsClient(eventAddress, 5, adapter)
	if err := obcEHClient.Start(); err != nil {
		fmt.Printf("could not start chat %s\n", err)
		obcEHClient.Stop()
		return nil
	}

	return adapter
}

func checkErr(err error) {
	if err != nil {
		fmt.Printf("%s\n", err)
		//panic(err)
	}
}

func UnicodeIndex(str, substr string) int {
	// 子串在字符串的字节位置
	result := strings.Index(str, substr)
	if result >= 0 {
		// 获得子串之前的字符串并转换成[]byte
		prefix := []byte(str)[0:result]
		// 将子串之前的字符串转换成[]rune
		rs := []rune(string(prefix))
		// 获得子串之前的字符串的长度，便是子串在字符串的字符位置
		result = len(rs)
	}

	return result
}

func SubString(str string, begin, length int) (substr string) {
	// 将字符串的转换成[]rune
	rs := []rune(str)
	lth := len(rs)

	// 简单的越界判断
	if begin < 0 {
		begin = 0
	}
	if begin >= lth {
		begin = lth
	}
	end := begin + length
	if end > lth {
		end = lth
	}

	// 返回子串
	return string(rs[begin:end])
}

func main() {

	var eventAddress string
	var listenToRejections bool
	var chaincodeID string
	flag.StringVar(&eventAddress, "events-address", "192.168.0.6:7053", "address of events server")
	flag.BoolVar(&listenToRejections, "listen-to-rejections", false, "whether to listen to rejection events")
	flag.StringVar(&chaincodeID, "events-from-chaincode", "", "listen to events from given chaincode")
	flag.Parse()

	fmt.Printf("Event Address: %s\n", eventAddress)

	a := createEventClient(eventAddress, listenToRejections, chaincodeID)
	if a == nil {
		fmt.Printf("Error creating event client\n")
		return
	}

	for {
		select {
		case b := <-a.notfy:
			fmt.Printf("\n")
			fmt.Printf("\n")
			fmt.Printf("Received block\n")
			fmt.Printf("--------------\n")
			for _, r := range b.Block.Transactions {
				fmt.Printf("Transaction:\n\t[%v]\n", r)
				//fmt.Printf("%v\n", r.Txid)
				//fmt.Printf("%s\n", string(r.Payload))
				//fmt.Printf("%v\n", r.GetTimestamp().Seconds)
				fmt.Printf("ChaincodeID:%v\n", string(r.ChaincodeID))

				rr := []rune(string(r.ChaincodeID))
				fmt.Println(string(rr))

				s := strings.Replace(string(r.Payload), string(r.ChaincodeID), "", -1)

				// s = strings.Replace(s, "\n", ",", -1)
				// fmt.Printf("s:%s\n", s)
				// tem_arr_parmas := strings.Split(s, "\000")
				// fmt.Printf("tem_arr_parmas:%s\n", tem_arr_parmas)
				// var tem_params string
				// for _, value := range tem_arr_parmas {
				// 	tem_params += SubString(value, 3, len(value)-3)
				// 	fmt.Printf("tem_params:%s\n", tem_params)
				// }

				//fmt.Printf("%s\n", tem_params)

				s = strings.Replace(s, "\000", "", -1)
				s = strings.Replace(s, "\001", "", -1)
				s = strings.Replace(s, "\002", "", -1)
				s = strings.Replace(s, "\003", "", -1)
				s = strings.Replace(s, "\004", "", -1)
				s = strings.Replace(s, "\005", "", -1)
				s = strings.Replace(s, "\006", "", -1)
				s = strings.Replace(s, "\007", "", -1)
				s = strings.Replace(s, "\010", "", -1)
				s = strings.Replace(s, "\n", ",", -1)

				var chaincodeType string
				var typeName string

				if r.Type.String() == "CHAINCODE_INVOKE" {
					chaincodeType = "invoke"
					typeName = "执行"
				}
				if r.Type.String() == "CHAINCODE_DEPLOY" {
					chaincodeType = "init"
					typeName = "部署"
				}

				fmt.Printf("%s\n", s)
				fmt.Printf("%s\n", UnicodeIndex(s, chaincodeType))
				begin := UnicodeIndex(s, chaincodeType) + len(chaincodeType) + 1
				end := len(s) - begin
				fmt.Printf("%s\n", end)
				params := SubString(s, begin, end)
				fmt.Printf("%s\n", params)
				arr_params := strings.Split(params, ",")

				var setParams string

				for index, value := range arr_params {
					setParams += "参数" + strconv.Itoa(index+1) + "：" + value + "<br>"
					fmt.Printf("arr[%d]=%d \n", index, value)
				}
				fmt.Printf("%s\n", setParams)

				// 进行解码
				// newTest := &Transaction{}
				// err = proto.Unmarshal(r, newTest)
				// if err != nil {
				// 	fmt.Println("err = " + err)
				// }

				var data_chaincodeID, data_Txid string
				if r.Type.String() == "CHAINCODE_DEPLOY" {
					data_chaincodeID = r.Txid
					data_Txid = "无"
				}
				if r.Type.String() == "CHAINCODE_INVOKE" {
					data_Txid = r.Txid
					data_chaincodeID = string(r.ChaincodeID)
					data_chaincodeID = strings.Replace(data_chaincodeID, "\022", "", -1)
					data_chaincodeID = strings.Replace(data_chaincodeID, "\200", "", -1)
					data_chaincodeID = strings.Replace(data_chaincodeID, "\001", "", -1)
				}

				tm := time.Unix(r.GetTimestamp().Seconds, 0)

				db, err := sql.Open("mysql", "root:b5UX6W7@tcp(127.0.0.1:3306)/explorer?charset=utf8")
				checkErr(err)
				if err == nil {
					//插入数据
					stmt, err := db.Prepare("INSERT log SET Operation=?,Params=?,ChaincodeId=?,TransactionId=?,PeerName=?,userName=?,CreateDate=?")
					checkErr(err)
					if err == nil {
						_, err := stmt.Exec(typeName, setParams, data_chaincodeID, data_Txid, "", "", tm.Format("2006-01-02 15:04:05"))
						checkErr(err)

					}

					// id, err := res.LastInsertId()
					// checkErr(err)

					// fmt.Println(id)
					db.Close()
				}

			}
		case r := <-a.rejected:
			fmt.Printf("\n")
			fmt.Printf("\n")
			fmt.Printf("Received rejected transaction\n")
			fmt.Printf("--------------\n")
			fmt.Printf("Transaction error:\n%s\t%s\n", r.Rejection.Tx.Txid, r.Rejection.ErrorMsg)
		case ce := <-a.cEvent:
			fmt.Printf("\n")
			fmt.Printf("\n")
			fmt.Printf("Received chaincode event\n")
			fmt.Printf("------------------------\n")
			fmt.Printf("Chaincode Event:%v\n", ce)
		}
	}
}
