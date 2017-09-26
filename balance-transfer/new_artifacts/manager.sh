#!/bin/bash
pushd /opt/fabric-1.0/bin


export ordererIp=192.168.0.10


export ORG_NAME=aaa
export DOMAIN=bbb.com
export COUNT=2
export SELF_NUM=peer$[1-1]
export PEER_SELF=192.168.0.9








export PEER0=192.168.0.11
export CONTAINER_NAME=vp_0
export CORE_PEER_ID=vp0
export CORE_SECURITY_ENROLLID=test_vp0
export CORE_SECURITY_ENROLLSECRET=MwYpmSRjupbT
export COMMAND='sh -c "peer node start"'

export username="\"user0\""
export password="\"MS9qrN8hFjlE\""






CMPF=$2
usage="manager.sh [command] [docker-compose-file]"

# Return info when executing commands
run() {
    "$@"
    local status=$?
    if [ $status -ne 0 ]; then
        echo "Error: $1" >&2
        exit $status
    fi
    return $status
}

if [ $# -lt 2 ]
then
  echo "Error args"
  exit 1
fi

 
stop() {
  docker stop $CONTAINER_NAME
}

start() {
  getNFS
  #get skFile
  export skFile=$(ls /opt/fabric-1.0/app-network/new_artifacts/channel/crypto-config/peerOrganizations/org$ORG_NAME.$DOMAIN/ca |grep "sk")
  
  
  run /usr/local/bin/docker-compose -f $1 up --no-recreate -d
  #register
}

register(){
checkpoint="http://127.0.0.1:7050/registrar"
count=0
while(( $count<1 ))
do
RETURN_STR=`curl -d '{"enrollId": '${username}',"enrollSecret": '${password}'}'   $checkpoint`

result=$(echo $RETURN_STR | grep "OK")
if [[ "$result" != "" ]]
then
  echo "login success"
  let "count++"
else
  sleep 5s;
  echo "login fail"
fi

done
}

getNFS(){
mount -t nfs $ordererIp:/opt/fabric-1.0/app-network/new_artifacts/channel/ /opt/fabric-1.0/app-network/new_artifacts/channel/ 
sleep 5 
}

restart() {
  stop $1
  start $1
}

reload() {
  run docker restart $1 
}

check() {
  if [ $# -lt 2 ]
  then
    echo "Missing arg..."
    exit 1
  fi  
}

echo "Check..."
check $@


case $1 in
    start)
    start $CMPF
    ;;
    stop)
    stop $CMPF
    ;;
    restart)
    restart $CMPF
    ;;
    reload)
    reload $2
    ;;
    *)
    echo "invaid $1 $usage"
    exit 1;;
esac

popd
exit 0


