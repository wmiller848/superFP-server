/**
 * NodeJS Server
 * William C Miller
 * 2013
 */
// Versions
var vMaster = 0;
var vMajor = 0;
var vMinor = 1;
// Global References
var server = null;
var port = 3333;

// Node Modules
// Http/Sockets
var http = require('http'),
	static = require('node-static'),
	url = require('url'),
	// File System
	os = require('os'),
	fs = require('fs'),
	exec = require('child_process').exec,
	spawn = require('child_process').spawn,
	temp = require('temp');

// Set up Http File Serving
var fileServer = new static.Server('./client');
function serveHttp(request, response)
{    
	request.addListener('end', function()
	{
		//fileServer.serve(request, response);
	}).resume();
};

var host = http.createServer(serveHttp);
host.listen(port);

var io = require('socket.io').listen(host);

// Server Class
var SFP_Server = function(debug)
{
	var self = this;
	self.debug = debug;
	
	self.users = [];
	self.os = os.type();
	self.io = io;
	self.dir = '';
	
	self.left = 0;
	self.right = 1;
	
	self.cycle = 100;
};

SFP_Server.prototype.init = function()
{
	var self = server;
	self.name = "SFP Server -" + self.os;
	self.version = "v" + vMaster + "." + vMajor + "." + vMinor;
	
	self.log('CopyRight (c) William C Miller 2013');
	self.log(self.version);
	self.log("Server Started on Port " + port);
	
	self.socket = null;
	// Set up Sockets
	// Remove for verbose logs
	self.io.set('log level', 1);
	self.io.sockets.on('connection', function(socket)
	{
		self.log('Socket Connection Detected with ID: ' + socket.id);
		self.socket = socket;
		// Get Client Information
		socket.emit('requestClientID', null);
		socket.on('clientInfo', self.clientInfo);
		socket.on('addAvatar', self.addAvatar);
		
		socket.on('uN', self.updateAvatarForClient);
		
		socket.on('disconnect', self.removeClient);
		
		var user = 
		{ 
			socket : socket, 
			userID : null, 
			settings : null ,
			avatar :
			{
				selected : false,
				id : 'unknown',
				instance : null,
				timeStamp : 0,
				direction : self.left
			},
			remove : false
		}
		self.users.push(user);
	});
	
	var tempDir = '';
	var tempTest = temp.path({suffix : '.txt'}).split('/');
	for(var i  = 0; i < tempTest.length-1; i++)
	{
		tempDir += tempTest[i];
		tempDir += '/';
	}
	self.dir = tempDir;
	self.log("Temp Directory: " + self.dir);
	
	self.log("Update Cycle Set to " + self.cycle + "ms, starting in 10 seconds...");
	setTimeout(function()
	{
		self.log("Starting Update Cycle: " + self.cycle + "ms");
		self.updateAvatarsForClients();
	}, 10000)
};

SFP_Server.prototype.log = function(msg, obj)
{
	var self = server;
	if(self.debug == true)
	{
		if(typeof msg == "string")
		{
			console.log(self.name + '- ' + msg);
		}
		else
		{
			console.log(msg);
		}
		
		if(obj)
		{
			console.log(obj);
		}
	}
};

// Socket Handlers
SFP_Server.prototype.clientInfo = function(packet)
{
	var self = server;
	var socket = this;
	self.log("Number of Active Users: " + self.users.length);
	for(var i = 0; i < self.users.length; i++)
	{
		var user = self.users[i];
		if(user.socket.id == socket.id)
		{
			user.userID = packet.auth;	
			self.log("Client <---> Socket pair matched, authorization: " + user.userID);
		}
		else
		{
			if(user.avatar.id != 'unknown')
				socket.emit('addNetworkUser', {id: user.userID, avatarName : user.avatar.id});
		}
	}
};

SFP_Server.prototype.addAvatar = function(packet)
{
	var self = server;
	var socket = this;
	var id = null;
	var newUser = null;
	
	self.log("Adding Avatar for client " + packet.auth);
	for(var i = 0; i < self.users.length; i++)
	{
		var user = self.users[i];
		if(user.socket.id == socket.id)
		{
			id = user.userID;
			
			user.avatar = packet.avatar;
			newUser = user;
		}
	}
	
	socket.broadcast.emit('addNetworkUser', {id: id, avatarName : newUser.avatar.id});
};

SFP_Server.prototype.removeClient = function()
{
	var self = server;
	var socket = this;
	
	for(var i = 0; i < self.users.length; i++)
	{
		var user = self.users[i];
		if(user.socket.id == socket.id)
		{
			self.log("Removing Client " + user.userID);
			user.remove = true;	
			
			if(user.avatar.id != 'unknown')
				socket.broadcast.emit('removeNetworkUser', {id: user.userID, avatarName : user.avatar.id});		
		}
	}
	
	var newUsers = [];
	for(var i = 0; i < self.users.length; i++)
	{
		var user = self.users[i];
		if(user.remove == false)
		{
			newUsers.push(user);
		}
	}
	self.users = newUsers;
};

SFP_Server.prototype.updateAvatarForClient = function(packet)
{
	var self = server;
	var socket = this;
	
	var numUsers = self.users.length;
	for(var i = 0; i < numUsers; i++)
	{
		var user = self.users[i];
		if(user.userID == packet.auth)
		{
			if(packet.avatarInstance != null)
			{
					user.avatar.instance = packet.avatarInstance;
					// Clean user flag
					user.avatar.instance.user = false;
			}
		}
	};
};

SFP_Server.prototype.updateAvatarsForClients = function()
{
	var self = server;
	var numUsers = self.users.length;
	for(var i = 0; i < numUsers; i++)
	{
		var user = self.users[i];
		if(user.socket != null)
		{
			var packet = 
			{
				totalUsers: numUsers,
				id : user.userID, 
				avatarInstance : user.avatar.instance
			};
			user.socket.broadcast.emit("rN", packet);		
		}
	};
	setTimeout(self.updateAvatarsForClients, self.cycle);
};

// Start Sever via Anonymous Function
(function()
{
	server = new SFP_Server(true);
	server.init();
})();
