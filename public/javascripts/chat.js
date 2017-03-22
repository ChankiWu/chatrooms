/**
 * Created by lenovo on 2017/2/11.
 */

//这段代码相当于定义了一个JavaScript“类”，在初始化时可用传入一个Socket.IO的参数socket：
var Chat = function (socket) {
  this.socket = socket;
};

//接着添加这个发送聊天消息的函数：
Chat.prototype.sendMessage = function (room,text) {

    var message = {
        room:room,
        text:text
    };
    this.socket.emit('message',message);
};

//变更房间的函数：
Chat.prototype.changeRoom = function (room) {
  this.socket.emit('join',{
     newRoom:room
  });
};

//最后添加下面代码清单中定义的函数，处理聊天命令。它能识别两个命令：join用来加入或创建一个房间，nick用来修改昵称。
Chat.prototype.processCommand = function (command) {

    var words = command.split(' ');
    var command = words[0]
        .substring(1,words[0].length)
        .toLowerCase();//从第一个单词开始解析命令
    var message = false;

    switch (command){
        case 'join':
            //处理房间的变换/创建
            words.shift();
            var room = words.join(' ');
            this.changeRoom(room);
            break;
        case 'nick':
            //处理更名尝试
            words.shift();
            var name = words.join(' ');
            this.socket.emit('nameAttempt',name);
            break;

        default:
            ///如果命令无法识别， 返回错误消息
            message = 'Unrecognized command.';
            break;
    }

    return message;
};