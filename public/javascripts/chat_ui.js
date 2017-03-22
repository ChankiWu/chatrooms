/**
 * Created by lenovo on 2017/2/11.
 */

//函数divEscapedContentElement用来显示可疑的文本。它会净化文本，将特殊字符转换成HTML实体，这样浏览器就会按输入的样子显示它们，而不会试图按HTML标签解释它们。

//函数divSystemContentElement用来显示系统创建的受信内容，而不是其他用户创建的。

function divEscapedContentElement(message) {
    return $('<div></div>').text(message);
}

function divSystemContentElement(message) {
    return $('<div></div>').html('<i>' + message + '</i>');
}

//如果用户输入的内容以斜杠（/）开头，它会将其作为聊天命令处理。如果不是，就作为聊天消息发送 给服务器并广播给其他用户，并添加到用户所在聊天室的聊天文本中。 处理原始的用户输入

function processUserInput(chatApp,socket) {
    var message = $('#send-message').val();
    var systemMessage;

    //如果用户输入的内容以斜杠（/） 开头，将其作为聊天命令
    if (message.charAt(0) == '/'){
        systemMessage = chatApp.processCommand(message);
        if (systemMessage){
            $('#messages').append(divSystemContentElement(systemMessage));
        }
    }else {
        //将非命令输入广播给其他用户
     chatApp.sendMessage($('#room').text(),message);
     $('#messages').append(divEscapedContentElement(message));
     $('#messages').scrollTop($('#messages').prop('scrollHeight'));

    }

    $('#send-message').val('');
}

//这段代码会对客户端的Socket.IO事件处理进行初始化。
var socket = io.connect();

$(document).ready(function () {

    var chatApp = new Chat(socket);

    //显示更名尝试的结果
    socket.on('nameResult',function (result) {
        var message;

        if(result.success){
            message = 'You are known as ' + result.name + '.';
        }else {
            message = result.message;
        }
    });

    //显示房间变更结果
    socket.on('joinResult',function (result) {
       $('#room').text(result.room);
       $('#messages').append(divSystemContentElement('Room changed.'));
    });

    //显示接收到的消息
    socket.on('message',function (message) {
        var newElement = $('<div></div>').text(message.text);
        $('#messages').append(newElement);
    });

    //显示可用房间列表
    socket.on('rooms',function (rooms) {
        $('#room-list').empty();

        for (var room in rooms) {
            room = room.substring(1,room.length);
            if(room != ''){
                $('#room-list').append(divEscapedContentElement(room));
            }
        }

        //点击房间名可以换到那个房间中
        $('#room-list div').click(function () {
            chatApp.processCommand('/join' + $(this).text());
            $('#send-message').focus();

        });
    });

    //定期请求可用房间列表
    setInterval(function () {
        socket.emit('rooms');
    },1000);


    $('#send-message').focus();

    //提交表单可以发送聊天消息
    $('#send-form').submit(function () {
        processUserInput(chatApp,socket);
        return false;
        //return true;
    });

});