/*
 Copyright IBM Corp All Rights Reserved.

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

package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/hyperledger/fabric/core/ledger/util"
	//"github.com/hyperledger/fabric/events/consumer"
	"github.com/hyperledger/fabric/msp/mgmt"
	"github.com/hyperledger/fabric/msp/mgmt/testtools"
	"github.com/hyperledger/fabric/protos/common"
	pb "github.com/hyperledger/fabric/protos/peer"
	"github.com/hyperledger/fabric/protos/utils"
	_ "github.com/go-sql-driver/mysql"
	"database/sql"

)

var (
	dbhostsip  = "172.17.16.74:3306" //IP地址
	dbusername = "root"           //用户名
	dbpassword = "kojh"         //密码
	dbname     = "explorer_lmh"           //表名
)

func checkErr(err error) {
	if err != nil {
		fmt.Printf("%s\n", err)
		//panic(err)
	}
}

type adapter struct {
	notfy chan *pb.Event_Block
}

//GetInterestedEvents implements consumer.EventAdapter interface for registering interested events
func (a *adapter) GetInterestedEvents() ([]*pb.Interest, error) {
	return []*pb.Interest{{EventType: pb.EventType_BLOCK}}, nil
}

//Recv implements consumer.EventAdapter interface for receiving events
func (a *adapter) Recv(msg *pb.Event) (bool, error) {
	if o, e := msg.Event.(*pb.Event_Block); e {
		a.notfy <- o
		return true, nil
	}
	return false, fmt.Errorf("Receive unknown type event: %v", msg)
}

//Disconnected implements consumer.EventAdapter interface for disconnecting
func (a *adapter) Disconnected(err error) {
	fmt.Print("Disconnected...exiting\n")
	os.Exit(1)
}

func createEventClient(eventAddress string,sn string,peer_tls_root_cert_file string, _ string) *adapter {
	var obcEHClient *EventsClient

	done := make(chan *pb.Event_Block)
	adapter := &adapter{notfy: done}
	obcEHClient, _ = NewEventsClient(eventAddress,sn,peer_tls_root_cert_file, 5, adapter)
	if err := obcEHClient.Start(); err != nil {
		fmt.Printf("could not start chat. err: %s\n", err)
		obcEHClient.Stop()
		return nil
	}

	return adapter
}
func getTxPayload(tdata []byte) (*common.Payload, error) {
	if tdata == nil {
		return nil, errors.New("Cannot extract payload from nil transaction")
	}

	if env, err := utils.GetEnvelopeFromBlock(tdata); err != nil {
		return nil, fmt.Errorf("Error getting tx from block(%s)", err)
	} else if env != nil {
		// get the payload from the envelope
		payload, err := utils.GetPayload(env)
		if err != nil {
			return nil, fmt.Errorf("Could not extract payload from envelope, err %s", err)
		}
		return payload, nil
	}
	return nil, nil
}

// getChainCodeEvents parses block events for chaincode events associated with individual transactions
func getChainCodeEvents(tdata []byte) (*pb.ChaincodeAction, error) {
	if tdata == nil {
		return nil, errors.New("Cannot extract payload from nil transaction")
	}

	if env, err := utils.GetEnvelopeFromBlock(tdata); err != nil {
		return nil, fmt.Errorf("Error getting tx from block(%s)", err)
	} else if env != nil {
		//fmt.Println("****************111 env: %s", env)
		// get the payload from the envelope
		payload, err := utils.GetPayload(env)
		//fmt.Println("****************2222 payload: %s",payload)
		if err != nil {
			return nil, fmt.Errorf("Could not extract payload from envelope, err %s", err)
		}

		chdr, err := utils.UnmarshalChannelHeader(payload.Header.ChannelHeader)
		fmt.Println("****************333 chdr: %s",chdr)
		if err != nil {
			return nil, fmt.Errorf("Could not extract channel header from envelope, err %s", err)
		}

		if common.HeaderType(chdr.Type) == common.HeaderType_ENDORSER_TRANSACTION {
			tx, err := utils.GetTransaction(payload.Data)
		//fmt.Println("****************!!!!! tx: '%s'",tx)
			if err != nil {
				//return nil, fmt.Errorf("Error unmarshalling transaction payload for block event: %s", err)
			}
		//fmt.Println("****************!!!!! tx.Actions[0].Payload: '%s'",tx.Actions[0].Payload)
			chaincodeActionPayload, err := utils.GetChaincodeActionPayload(tx.Actions[0].Payload)
			//fmt.Println("****************444 chaincodeActionPayload: %s",chaincodeActionPayload)

		    //chaincodeProposalPayload, err :=utils.GetChaincodeProposalPayload(tx.Actions[0].Payload)

		   //fmt.Println("****************!!!! chaincodeProposalPayload: '%s'",chaincodeProposalPayload)

			if err != nil {
				return nil, fmt.Errorf("Error unmarshalling transaction action payload for block event: %s", err)
			}
			propRespPayload, err := utils.GetProposalResponsePayload(chaincodeActionPayload.Action.ProposalResponsePayload)
			fmt.Println("**************** propRespPayload: %s", propRespPayload)
			if err != nil {
				return nil, fmt.Errorf("Error unmarshalling proposal response payload for block event: %s", err)
			}
			caPayload, err := utils.GetChaincodeAction(propRespPayload.Extension)
			fmt.Println("**************** caPayload: %s",caPayload)
			if err != nil {
				return nil, fmt.Errorf("Error unmarshalling chaincode action for block event: %s", err)
			}
			//ccEvent, err := utils.GetChaincodeEvents(caPayload.Events)
		   // fmt.Println("****************777 ccEvent %s",ccEvent)
		   //fmt.Println("****************888 caPayload.chaincode_id %s",caPayload.ChaincodeId)
             return  caPayload,nil
			//if ccEvent != nil {
			//	return ccEvent, nil
			//}
		}
	}
	return nil, errors.New("No events found")
}

// getChaincodeProposalPayload parses block events for chaincode events associated with individual transactions
func getChaincodeProposalPayload(tdata []byte) (*pb.ChaincodeProposalPayload, error) {
	if tdata == nil {
		return nil, errors.New("Cannot extract payload from nil transaction")
	}

	if env, err := utils.GetEnvelopeFromBlock(tdata); err != nil {
		return nil, fmt.Errorf("Error getting tx from block(%s)", err)
	} else if env != nil {
		//fmt.Println("****************111 env: %s", env)
		// get the payload from the envelope
		payload, err := utils.GetPayload(env)
		//fmt.Println("****************2222 payload: %s",payload)
		if err != nil {
			return nil, fmt.Errorf("Could not extract payload from envelope, err %s", err)
		}


		//if common.HeaderType(chdr.Type) == common.HeaderType_ENDORSER_TRANSACTION {
		tx, err := utils.GetTransaction(payload.Data)
		//fmt.Println("****************!!!!! tx: '%s'",tx)
		if err != nil {
			//return nil, fmt.Errorf("Error unmarshalling transaction payload for block event: %s", err)
		}
		//fmt.Println("****************!!!!! tx.Actions[0].Payload: '%s'",tx.Actions[0].Payload)
		chaincodeActionPayload, err := utils.GetChaincodeActionPayload(tx.Actions[0].Payload)
		fmt.Println("****************444 chaincodeActionPayload: %s",chaincodeActionPayload)

		chaincodeProposalPayload, err :=utils.GetChaincodeProposalPayload(tx.Actions[0].Payload)

		fmt.Println("****************!!!! chaincodeProposalPayload: '%s'",chaincodeProposalPayload)
		return  chaincodeProposalPayload,nil
	}
	return nil, errors.New("No ChaincodeProposalPayload found")
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
	var sn string
	var peer_tls_root_cert_file string
	var chaincodeID string
	var mspDir string
	var mspId string
	flag.StringVar(&eventAddress, "events-address", "0.0.0.0:7053", "address of events server")
	flag.StringVar(&sn, "events-sn", "peer0.org1.example.com", "domain of events server")
	flag.StringVar(&peer_tls_root_cert_file, "events-rootca", "", "peer root ca file paths")
	flag.StringVar(&chaincodeID, "events-from-chaincode", "", "listen to events from given chaincode")
	flag.StringVar(&mspDir, "events-mspdir", "", "set up the msp direction")
	flag.StringVar(&mspId, "events-mspid", "", "set up the mspid")
	flag.Parse()

	//if no msp info provided, we use the default MSP under fabric/sampleconfig
	if mspDir == "" {
		err := msptesttools.LoadMSPSetupForTesting()
		if err != nil {
			fmt.Printf("Could not initialize msp, err: %s\n", err)
			os.Exit(-1)
		}
	} else {
		//load msp info
		err := mgmt.LoadLocalMsp(mspDir, nil, mspId)
		if err != nil {
			fmt.Printf("Could not initialize msp, err: %s\n", err)
			os.Exit(-1)
		}
	}

	fmt.Printf("Event Address: %s\n", eventAddress)

	a := createEventClient(eventAddress, sn,peer_tls_root_cert_file,chaincodeID)
	if a == nil {
		fmt.Println("Error creating event client")
		return
	}
	fmt.Println("HeaderType : ")
	fmt.Println("Enum HeaderType { ")
	fmt.Println("MESSAGE = 0;                   // Used for messages which are signed but opaque")
	fmt.Println("CONFIG = 1;                    // Used for messages which express the channel config")
	fmt.Println("CONFIG_UPDATE = 2;             // Used for transactions which update the channel config")
	fmt.Println("ENDORSER_TRANSACTION = 3;      // Used by the SDK to submit endorser based transactions")
	fmt.Println("ORDERER_TRANSACTION = 4;       // Used internally by the orderer for management")
	fmt.Println("DELIVER_SEEK_INFO = 5;         // Used as the type for Envelope messages submitted to instruct the Deliver API to seek")
	fmt.Println("CHAINCODE_PACKAGE = 6;         // Used for packaging chaincode artifacts for install")
	fmt.Println("}\"")

	for {
		select {
		case b := <-a.notfy:
			fmt.Println("")
			fmt.Println("")
			fmt.Println("Received block")
			fmt.Println("--------------")
			fmt.Printf("------b '%s'",b);
			//b.Block.Data.Data.Payload.Data.Actions
			//var action=b.Block.Data.Data.Payload.Data.Actions.Action;
			//var action=b.Block.Data.Data;
			//fmt.Println("--------------action:  %s'' ",action)
			//fmt.Println("--------------action.Extension.Results:  %s'' ",action.Extension.Results)
			txsFltr := util.TxValidationFlags(b.Block.Metadata.Metadata[common.BlockMetadataIndex_TRANSACTIONS_FILTER])
			for i, r := range b.Block.Data.Data {
				tx, _ := getTxPayload(r)
				if tx != nil {
					chdr, err := utils.UnmarshalChannelHeader(tx.Header.ChannelHeader)
					if err != nil {
						fmt.Print("Error extracting channel header\n")
						return
					}
					if txsFltr.IsInvalid(i) {
						fmt.Println("")
						fmt.Println("")
						fmt.Printf("Received invalid transaction from channel '%s'\n", chdr.ChannelId)
						fmt.Println("--------------")
						fmt.Printf("Transaction invalid: TxID: %s\n", chdr.TxId)
					} else {
						sql_operation := ""
						sql_params := ""
						sql_chaincodeId := ""
						sql_transactionId :=chdr.TxId
						sql_channelId :=chdr.ChannelId

						fmt.Printf("Received transaction from channel '%s': \n\t[%v]\n", chdr.ChannelId, tx)
						//caPayload, err := getChainCodeEvents(r)
						if common.HeaderType(chdr.Type) == common.HeaderType_ENDORSER_TRANSACTION {
							tx_payload, err := utils.GetTransaction(tx.Data)
							chaincodeActionPayload, err := utils.GetChaincodeActionPayload(tx_payload.Actions[0].Payload)
							if err != nil {
								fmt.Println("Error unmarshalling transaction action payload for block event: %s", err)
							}
							chaincodeProposalPayload, err := utils.GetChaincodeProposalPayload(tx_payload.Actions[0].Payload)
							if err != nil {
								fmt.Println("Error unmarshalling chaincode Proposal Payload for block event: %s", err)
							}
							propRespPayload, err := utils.GetProposalResponsePayload(chaincodeActionPayload.Action.ProposalResponsePayload)
							fmt.Println("**************** propRespPayload: %s", propRespPayload)
							if err != nil {
								fmt.Println("Error unmarshalling proposal response payload for block event: %s", err)
							}
							caPayload, err := utils.GetChaincodeAction(propRespPayload.Extension)
							fmt.Println("**************** caPayload: %s", caPayload)
							fmt.Printf("****************!!!!! caPayload.GetResponse().Payload: '%s' \n", caPayload.GetResponse().Payload)
							fmt.Printf("****************!!!!! caPayload.GetResponse().Message: '%s' \n", caPayload.GetResponse().Message)
							if err != nil {
								fmt.Println("Error unmarshalling chaincode action for block event: %s", err)
							}
							fmt.Printf("**************9999999 chaincodeProposalPayloadl: '%s': \n", chaincodeProposalPayload)
							fmt.Printf("**************!!!!!!!!!! chaincodeProposalPayloadl.getInput: '%s': \n", chaincodeProposalPayload.GetInput())

							//处理ProposalPayload,
							str_chaincodeProposalPayload := chaincodeProposalPayload.String();
							arr := strings.Split(str_chaincodeProposalPayload, "\"");
							//fmt.Printf("**************88888 arr: '%s' \n", arr[0])
							fmt.Printf("**************88888 arr: '%s' \n", arr[1])

							s := strings.Replace(arr[1], "\\036", "", -1)
							s = strings.Replace(s, "\\000", "", -1)
							s = strings.Replace(s, "\\034", "", -1)
							s = strings.Replace(s, "\\003", "", -1)
							s = strings.Replace(s, "\\010", "", -1)
							s = strings.Replace(s, "\\007", "", -1)
							s = strings.Replace(s, "\\013", "", -1)
							s = strings.Replace(s, "\\014", "", -1)
							s = strings.Replace(s, "\\022", "", -1)
							s = strings.Replace(s, "\\020", "", -1)
							s = strings.Replace(s, "\\026", "", -1)
							s = strings.Replace(s, "\\021", "", -1)
							s = strings.Replace(s, "\\007", "", -1)
							s = strings.Replace(s, "\\005", "", -1)
							s = strings.Replace(s, "\\006", "", -1)
							s = strings.Replace(s, "\\017", "", -1)
							s = strings.Replace(s, "\\031", "", -1)
							s = strings.Replace(s, "\\032", "", -1)
							s = strings.Replace(s, "\\004", "", -1)
							s = strings.Replace(s, "\\035", "", -1)
							s = strings.Replace(s, "\\037", "", -1)
							s = strings.Replace(s, "\\001", "", -1)
							s = strings.Replace(s, "\\002", "", -1)
							s = strings.Replace(s, "\\tc", "", -1)
							s = strings.Replace(s, "\\t", "", -1)

							fmt.Printf("**************9999999 s: '%s' \n", s)
							arr_params := strings.Split(s, "\\n")
							fmt.Printf("**************9999999 arr_params: '%s' \n", arr_params)
							chaincodeId := arr_params[2]
							var functionName = arr_params[3]
							var chaincodeType = ""
							var params = "("
							//deploy  chaincod_event
							if  chaincodeId == "tlscch" && functionName == "deploy"{
								chaincodeType = "deploy"
								chaincodeId="lscc"
								right_arr := strings.Split(arr[1], ")");
								left_arr := strings.Split(right_arr[1], "(");
								m := strings.Replace(left_arr[0], "\\003", "", -1)
								m = strings.Replace(m, "\\001", "", -1)
								m = strings.Replace(m, "\\004", "", -1)
								m = strings.Replace(m, "\\026", "", -1)
								m = strings.Replace(m, "\\010", "", -1)
								m = strings.Replace(m, "\\022", "", -1)
								m = strings.Replace(m, "\\013", "", -1)
								m = strings.Replace(m, "\\032", "", -1)
								m = strings.Replace(m, "\\002", ":", -1)
								m = strings.Replace(m, "\\005", "", -1)
								m = strings.Replace(m, "'", "", -1)
								arr_params = strings.Split(m, "\\n")

								functionName=arr_params[2]
								for key, value := range arr_params {
									if key > 0 && key < (len(arr_params)-1){
									if key == (len(arr_params) - 2) {
										params = params + value + ")"
									} else {
										params = params + value + ","
									}
								 }
								}
								sql_operation ="部署合约"
								sql_chaincodeId =arr_params[1]
								sql_params = params
								if err == nil {

									fmt.Println("")
									fmt.Println("")
									fmt.Printf("Received chaincode event from channel '%s'\n", chdr.ChannelId)
									fmt.Printf("**********chdr.TxId is : '%s' \n", chdr.TxId)
									fmt.Printf("SystemChaincodeId is: '%s'\n", caPayload.ChaincodeId)
									fmt.Printf("deployChaincodeName is: '%s' \n", arr_params[1])
									fmt.Printf("chaincodeType is: '%s' \n", chaincodeType)
									fmt.Printf("FunctionName is: '%s' \n", functionName)
									fmt.Printf("Params is: '%s' \n", params)

								}
							}else if chaincodeId == "ulscci" && functionName == "upgrade" {
								chaincodeType = ""
								chaincodeId="lscc"
								right_arr := strings.Split(arr[1], ")");
								left_arr := strings.Split(right_arr[1], "(");
								m := strings.Replace(left_arr[0], "\\003", "", -1)
								m = strings.Replace(m, "\\001", "", -1)
								m = strings.Replace(m, "\\004", "", -1)
								m = strings.Replace(m, "\\026", "", -1)
								m = strings.Replace(m, "\\010", "", -1)
								m = strings.Replace(m, "\\022", "", -1)
								m = strings.Replace(m, "\\013", "", -1)
								m = strings.Replace(m, "\\032", "", -1)
								m = strings.Replace(m, "\\002", ":", -1)
								m = strings.Replace(m, "\\005", "", -1)
								m = strings.Replace(m, "'", "", -1)
								arr_params = strings.Split(m, "\\n")

								functionName=arr_params[2]
								for key, value := range arr_params {
									if key > 0 && key < (len(arr_params)-1){
										if key == (len(arr_params) - 2) {
											params = params + value + ")"
										} else {
											params = params + value + ","
										}
									}
								}
								sql_operation ="升级合约"
								sql_chaincodeId =arr_params[1]
								sql_params = params
								if err == nil {

									fmt.Println("")
									fmt.Println("")
									fmt.Printf("Received chaincode event from channel '%s'\n", chdr.ChannelId)
									fmt.Printf("**********chdr.TxId is : '%s' \n", chdr.TxId)
									fmt.Printf("SystemChaincodeId is: '%s'\n", caPayload.ChaincodeId)
									fmt.Printf("deployChaincodeName is: '%s' \n", arr_params[1])
									fmt.Printf("chaincodeType is: '%s' \n", chaincodeType)
									fmt.Printf("FunctionName is: '%s' \n", functionName)
									fmt.Printf("Params is: '%s' \n", params)

								}

							}else{
								chaincodeType = "invoke"
								for key, value := range arr_params {
									if key > 3 {

										if key == (len(arr_params) - 1) {
											params = params + value + ")"
										} else {
											params = params + value + ","
										}

									}
								}
								sql_operation ="执行合约"
								sql_chaincodeId =caPayload.ChaincodeId.Name+":"+caPayload.ChaincodeId.Version
								sql_params = params
								if err == nil {
									//if len(chaincodeID) != 0 && event.ChaincodeId == chaincodeID {
									fmt.Println("")
									fmt.Println("")
									fmt.Printf("Received chaincode event from channel '%s'\n", chdr.ChannelId)
									fmt.Printf("**********chdr.TxId is : '%s' \n", chdr.TxId)
									fmt.Printf("ChaincodeId is: '%s'\n", caPayload.ChaincodeId)
									fmt.Printf("ChaincodeName is: '%s' \n", chaincodeId)
									fmt.Printf("chaincodeType is: '%s' \n", chaincodeType)
									fmt.Printf("FunctionName is: '%s' \n", functionName)
									fmt.Printf("Params is: '%s' \n", params)
									//fmt.Printf("Chaincode Event:%+v\n", event)
									//}
								}
							}

						}
						if common.HeaderType(chdr.Type) == common.HeaderType_CONFIG{
							fmt.Printf("**********Create new channel,channelName is: '%s' \n", chdr.ChannelId)
							fmt.Printf("**********chdr.TxId is: '%s' \n", chdr.TxId)
							sql_operation ="创建管道"
						}
						fmt.Printf("**********chdr.Timestamp is: '%s' \n", chdr.Timestamp)
						tm := time.Unix(chdr.Timestamp.Seconds, 0)

						db, err := sql.Open("mysql", dbusername+":"+dbpassword+"@tcp("+dbhostsip+")/"+dbname+"?charset=utf8")
						checkErr(err)
						if err == nil {
							//插入数据
							stmt, err := db.Prepare("INSERT log SET operation=?,params=?,chaincodeId=?,transactionId=?,userName=?,createTime=?,channelId=?")
							checkErr(err)
							if err == nil {
								_, err := stmt.Exec(sql_operation, sql_params, sql_chaincodeId, sql_transactionId, "",tm.Format("2006-01-02 15:04:05"),sql_channelId)
								checkErr(err)

							}
							// id, err := res.LastInsertId()
							// checkErr(err)
							// fmt.Println(id)
							db.Close()
						}

					}


				}
			}
		}
	}
}
