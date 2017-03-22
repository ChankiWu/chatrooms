/**
 * Created by lenovo on 2017/2/10.
 */

//变量声明
var http = require('http');//提供http服务器和客户端的功能
var fs = require('fs');//提供与文件系统相关的功能
var path = require('path');//提供与路径相关的功能
var mime = require('mime');//根据文件扩展名得出MIME类型
var cache = {};//用来缓存文件内容的对象

//三个辅助函数以提供静态HTTP文件服务

//第一个是在所请求的文件不存在时 发送404错误的
function send404(response) {
    response.writeHead(404,{'Content-Type':'text/plain'});
    response.write('Error 404:resource not found.');
    response.end();
}

//第二个辅助函数提供文件数据服务。这个函数先写出正确的HTTP头，然后发送文件的内容。
function sendFile(response,filePath,fileContents) {
    response.writeHead(
      200,
        {"Content-type":mime.lookup(path.basename(filePath))}
    );
    response.end(fileContents);
}

//访问内存（RAM）要比访问文件系统快得多，所以Node程序通常会把常用的数据缓存到内存里。我们的聊天程序就要把静态文件缓存到内存中，只有第一次访问的时候才会从文件系统中 读取。下一个辅助函数会确定文件是否缓存了，如果是，就返回它。如果文件还没被缓存，它会从硬盘中读取并返回它。如果文件不存在，则返回一个HTTP 404错误作为响应。

function serveStatic(response,cache,abspath) {
    if(cache[abspath])//检查文件是否在缓存中
    {
        sendFile(response,abspath,cache[abspath]);
    }
    else {
        fs.exists(abspath,function (exists) {
           //检查文件是否存在
            if(exists){
                //从硬盘中读取文件
                fs.readFile(abspath,function (err,data) {
                    if(err){
                        send404(response);
                    }else {
                        cache[abspath] = data;
                        sendFile(response,abspath,data);//从硬盘中读取文件并返回
                    }
                });
            }
            else {
                send404(response);
            }
        });
    }
}

//在创建HTTP服务器时，需要给createServer传入一个匿名函数作为回调函数，由它来处理每个HTTP请求。这个回调函数接受两个参数：request和response。在这个回调执行时， HTTP服务器会分别组装这两个参数对象，以便你可以对请求的细节进行处理，并返回一个响应。

//创建Http服务器
var server = http.createServer(function (request,response) {
   var filePath = false;

   if(request.url == '/'){
       //确定返回的html文件
       filePath = 'public/index.html';
   }else {
       //将url路径转为文件的相对路径
       filePath = 'public' + request.url;
   }

   var absPath = './' + filePath;
   serveStatic(response,cache,absPath);//返回静态文件
});

//启动服务器，要求服务器监听TCP/IP端口3000。3000是随便选的，所有1024以上的未用端口 应该都可以

server.listen(3000,function () {
    console.log('Server listening on port 3000.');
});

//第一行加载一个定制的Node模块，它提供的逻辑是用来处理基于Socket.IO的服务端聊天功能的，我们在后文中再定义这个模块。第二行启动 Socket.IO服务器，给它提供一个已经定义好的HTTP服务器，这样它就能跟HTTP服务器共享同一个TCP/IP端口：

var chatServer = require('./lib/chat_server.js');
chatServer.listen(server);