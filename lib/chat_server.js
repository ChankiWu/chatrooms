/**
 * Created by lenovo on 2017/2/10.
 */

//这些声明让我们可以使用Socket.IO，并初始化了一些定义聊天状态的变量：
var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};

//定义聊天服务器函数listen。server.js中会调用这个函数。 它启动Socket.IO服务器，限定Socket.IO向控制台输出的日志的详细程度，并确定该如何处理每个接进来的连接。

exports.listen = function (server) {

    io = socketio.listen(server);//启动socket.io服务器，允许它搭载在已有的HTTP服务器上
    io.set('log level', 1);

    //定义每个用户连接的处理逻辑
    io.sockets.on('connection',function (socket) {
        //在用户连接上来时赋予其一个访客名
        guestNumber = assignGuestName(socket,guestNumber,nickNames,namesUsed);

        //在用户连接上来时把他放入聊天室Lobby里
        joinRoom(socket,'Lobby');

        //处理用户的消息， 更名，以及聊天室的创建和变更
        handleMessageBroadcasting(socket,nickNames);
        handleNameChangeAttempts(socket,nickNames,namesUsed);
        handleRoomJoining(socket);

        //用户发出请求时，向其提供已经被占用的聊天时的列表
        socket.on('rooms',function () {
            socket.emit('rooms',io.sockets.manager.rooms);
        });

        //定义用户断开连接后的清除逻辑
        handleClientDisconnection(socket,nickNames,namesUsed);
    });
};

//添加几个辅助函数

//1.要添加的第一个辅助函数是assignGuestName，用来处理新用户的昵称。当用户第一次连到聊天服务器上时，用户会被放到一个叫做Lobby的聊天室中，并调用assignGuestName给他们 分配一个昵称，以便可以相互区分开。 程序分配的所有昵称基本上都是在Guest后面加上一个数字，有新用户连进来时这个数字就 会往上增长。用户昵称存在变量nickNames中以便于引用，并且会跟一个内部socket ID关联。昵称还会被添加到namesUsed中，这个变量中保存的是已经被占用的昵称。

function assignGuestName(socket,guestNumber,nickNames,namesUsed) {

    //生成新的昵称
    var name = 'Guest' + guestNumber;

    //把用户昵称跟客户端连接ID关联上
    nickNames[socket.id] = name;

    //让用户知道他们的昵称
    socket.emit('nameResult',{
      success:true,
        name:name
    });

    //存放已经被占用的昵称
    namesUsed.push(name);

    //增加用来生成昵称的计数器
    return guestNumber + 1;
}

//2.要添加到chat_server.js中的第二个辅助函数是joinRoom。处理逻辑跟用户加入聊天室相关。
function joinRoom(socket,room) {

    //让用户进入房间
    socket.join(room);

    //记录用户的当前房间
    currentRoom[socket.id] = room;

    //让用户知道他们进入了新的房间
    socket.emit('joinResult',{room:room});

    //让房间里的其他用户知道有新用户进入了房间
    socket.broadcast.to(room).emit('message',{
        text:nickNames[socket.id] + ' has joined ' + room +'.'
    });

    //确定有哪些用户在这个房间里
    var usersInRoom = io.sockets.clients(room);

    //如果不止一个用户在这个房间里， 汇总下都是谁
    if(usersInRoom.length > 1){
        var usersInRoomSummary = 'Users currently in ' + room +': ';
        for(var index in usersInRoom){
            var userSocketId = usersInRoom[index].id;
            if(userSocketId != socket.id){
                if(index>0){
                    usersInRoomSummary += ', '
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }

        //将房间里其他用户的信息汇总发送给这个用户
        usersInRoomSummary += '.';
        socket.emit('message',{text:usersInRoomSummary});
    }
}
//将用户加入Socket.IO房间很简单，只要调用socket对象上的join方法就行。然后程序就会把相关细节向这个用户及同一房间中的其他用户发送。程序会让用户知道有哪些用户在这个房间里，还会让其他用户知道这个用户进来了。

//3.更名请求的处理逻辑:如果用户都用程序分配的昵称，很难记住谁是谁。因此聊天程序允许用户发起更名请求。更名需要用户的浏览器通过Socket.IO发送一个请求，并接收表示成功或失败的响应。从程序的角度来讲，用户不能将昵称改成以Guest开头，或改成其他已经被占用的昵称。

function handleNameChangeAttempts(socket,nickNames,namesUsed) {

    //添加nameAttempt事件的监听器
    socket.on('nameAttempt',function (name) {
        if(name.indexOf('Guest') == 0){
            socket.emit('nameResult',{
                success:false,
                message:'Names cannot begin with "Guest".'
            });
        }else{
            //如果昵称还没注册就注册上
            if(namesUsed.indexOf(name)==-1){
                var previousName = nickNames[socket.id];
                var previousNameIndex = namesUsed.indexOf(previousName);

                namesUsed.push(name);
                nickNames[socket.id] = name;
                //删掉之前用的昵称，让其他用户可以使用
                delete namesUsed[previousNameIndex];

                socket.emit('nameResult',{
                   success:true,
                    name:name
                });
                socket.broadcast.to(currentRoom[socket.id]).emit('messsage',{
                    text:previousName + ' is now known as ' + name + '.'
                });

            }else{
                //如果昵称已经被占用，给客户端发送错误消息
                socket.emit('nameResult',{
                    success:false,
                    message:'That name is already in use.'
                });
           }
        }
    });

}

//4. 发送聊天消息 用户发射一个事件，表明消息是从哪个房间发出来的，以及消息的内容是什么；然后服务器将这条消息转发给同一房间的所有用户。
function handleMessageBroadcasting(socket) {
    socket.on('message',function (message) {
        socket.broadcast.to(message.room).emit('message',{
           text:nickNames[socket.id] + ': ' + message.text
        });
    });
}

//5. 创建房间 接下来要添加让用户加入已有房间的逻辑，如果房间还没有的话，则创建一个房间。实现更换房间的功能
function handleRoomJoining(socket) {
    socket.on('join',function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket,room.newRoom)
    });
}

//6.用户断开连接 当用户离开聊天程序时，从nickNames和namesUsed中移除用户的昵称：
function handleClientDisconnection(socket) {
    socket.on('disconnect',function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);

        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}

//服务端的逻辑都已经做好了


