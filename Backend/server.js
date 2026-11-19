
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;

// SOCKET.IO CONFIGURATION
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ROOMS STORAGE
const rooms = {};

// MULTER STORAGE CONFIGURATION
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },

    filename: function (req, file, cb) {
        const fileName = Date.now() + "-" + file.originalname;
        cb(null, fileName);
    }
});

const upload = multer({
    storage: storage
});

// HOME ROUTE
app.get("/", (req, res) => {
    res.send("PicConnect Backend Server is Running!");
});

// =================================
// CREATE ROOM API
// =================================

app.post("/api/rooms", (req, res) => {

    const roomId = Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

    rooms[roomId] = {
        roomId: roomId,
        users: [],
        onlineUsers: [],
        callUsers: [],
        files: [],
        messages: [],
        createdAt: new Date()
    };

    res.status(201).json({
        message: "Room created successfully",
        roomId: roomId
    });
});

// =================================
// JOIN ROOM API
// =================================

app.post("/api/rooms/:roomId/join", (req, res) => {

    const roomId = req.params.roomId;
    const username = req.body.username;

    if (!rooms[roomId]) {
        return res.status(404).json({
            message: "Room not found"
        });
    }

    if (!username || !username.trim()) {
        return res.status(400).json({
            message: "Username is required"
        });
    }

    if (rooms[roomId].users.length >= 10) {
        return res.status(400).json({
            message: "Room is full. Maximum 10 users allowed."
        });
    }

    const user = {
        id: Date.now(),
        username: username.trim()
    };

    rooms[roomId].users.push(user);

    res.status(200).json({
        message: "User joined successfully",
        roomId: roomId,
        user: user
    });
});

// =================================
// GET ROOM DETAILS
// =================================

app.get("/api/rooms/:roomId", (req, res) => {

    const roomId = req.params.roomId;

    if (!rooms[roomId]) {
        return res.status(404).json({
            message: "Room not found"
        });
    }

    res.status(200).json(rooms[roomId]);
});

// =================================
// UPLOAD FILE API
// =================================

app.post(
    "/api/rooms/:roomId/upload",
    upload.single("file"),
    (req, res) => {

        const roomId = req.params.roomId;

        if (!rooms[roomId]) {

            if (req.file) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(404).json({
                message: "Room not found"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "No file uploaded"
            });
        }

        const file = {
            id: Date.now(),
            originalName: req.file.originalname,
            fileName: req.file.filename,
            fileType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date()
        };

        rooms[roomId].files.push(file);

        // REAL-TIME FILE SYNCHRONIZATION
        io.to(roomId).emit("file-added", file);

        res.status(201).json({
            message: "File uploaded successfully",
            file: file
        });
    }
);

// =================================
// GET ROOM FILES
// =================================

app.get("/api/rooms/:roomId/files", (req, res) => {

    const roomId = req.params.roomId;

    if (!rooms[roomId]) {
        return res.status(404).json({
            message: "Room not found"
        });
    }

    res.status(200).json({
        roomId: roomId,
        files: rooms[roomId].files
    });
});

// =================================
// DELETE FILE API
// =================================

app.delete(
    "/api/rooms/:roomId/files/:fileId",
    (req, res) => {

        const roomId = req.params.roomId;
        const fileId = Number(req.params.fileId);

        if (!rooms[roomId]) {
            return res.status(404).json({
                message: "Room not found"
            });
        }

        const fileIndex = rooms[roomId].files.findIndex(
            file => file.id === fileId
        );

        if (fileIndex === -1) {
            return res.status(404).json({
                message: "File not found"
            });
        }

        const file = rooms[roomId].files[fileIndex];

        const filePath = path.join(
            __dirname,
            "uploads",
            file.fileName
        );

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        rooms[roomId].files.splice(fileIndex, 1);

        // REAL-TIME DELETE SYNCHRONIZATION
        io.to(roomId).emit("file-deleted", {
            id: fileId
        });

        res.status(200).json({
            message: "File deleted successfully"
        });
    }
);

// =================================
// SOCKET.IO - REAL-TIME FEATURES
// =================================

io.on("connection", (socket) => {

    console.log("User connected:", socket.id);

    // =================================
    // JOIN ROOM - ONLINE USERS + CHAT
    // =================================

    socket.on("join-room", (data) => {

        if (!data) return;

        const { roomId, username } = data;

        if (
            !roomId ||
            !username ||
            !username.trim() ||
            !rooms[roomId]
        ) {
            socket.emit("chat-error", "Invalid room or username");
            return;
        }

        // REMOVE FROM PREVIOUS ROOM
        if (socket.roomId && rooms[socket.roomId]) {

            const oldRoom = socket.roomId;

            // REMOVE USER FROM PREVIOUS VIDEO CALL
            rooms[oldRoom].callUsers =
                (rooms[oldRoom].callUsers || []).filter(
                    user => user.id !== socket.id
                );

            socket.to(oldRoom).emit("call-peer-left", {
                id: socket.id
            });

            rooms[oldRoom].onlineUsers =
                rooms[oldRoom].onlineUsers.filter(
                    user => user.id !== socket.id
                );

            socket.leave(oldRoom);

            io.to(oldRoom).emit(
                "online-users",
                rooms[oldRoom].onlineUsers
            );
        }

        // JOIN NEW ROOM
        socket.join(roomId);

        socket.roomId = roomId;
        socket.username = username.trim();

        // INITIALIZE ONLINE USERS
        if (!rooms[roomId].onlineUsers) {
            rooms[roomId].onlineUsers = [];
        }

        // INITIALIZE VIDEO CALL USERS
        if (!rooms[roomId].callUsers) {
            rooms[roomId].callUsers = [];
        }

        // PREVENT DUPLICATE SOCKET ENTRIES
        rooms[roomId].onlineUsers =
            rooms[roomId].onlineUsers.filter(
                user => user.id !== socket.id
            );

        // ADD CURRENT USER
        rooms[roomId].onlineUsers.push({
            id: socket.id,
            username: socket.username
        });

        // SEND PREVIOUS CHAT MESSAGES
        socket.emit(
            "previous-messages",
            rooms[roomId].messages
        );

        // BROADCAST ONLINE USERS
        io.to(roomId).emit(
            "online-users",
            rooms[roomId].onlineUsers
        );

        console.log(
            socket.username + " joined room " + roomId
        );
    });

    // =================================
    // REAL-TIME CHAT
    // =================================

    socket.on("send-message", (text) => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId]) return;

        if (typeof text !== "string" || !text.trim()) return;

        const message = {
            id: Date.now() + "-" + socket.id,
            username: socket.username,
            text: text.trim(),
            time: new Date()
        };

        rooms[roomId].messages.push(message);

        io.to(roomId).emit("receive-message", message);
    });

    // =================================
    // TYPING INDICATOR
    // =================================

    socket.on("typing", () => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId]) return;

        socket.to(roomId).emit("user-typing", {
            username: socket.username,
            isTyping: true
        });
    });

    // =================================
    // STOP TYPING
    // =================================

    socket.on("stop-typing", () => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId]) return;

        socket.to(roomId).emit("user-typing", {
            username: socket.username,
            isTyping: false
        });
    });

    // =================================
    // WEBRTC VIDEO CALL SIGNALING
    // =================================

    // JOIN VIDEO CALL
    socket.on("call-join", () => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId]) return;

        if (!rooms[roomId].callUsers) {
            rooms[roomId].callUsers = [];
        }

        // PREVENT DUPLICATE PARTICIPANTS
        if (
            rooms[roomId].callUsers.some(
                user => user.id === socket.id
            )
        ) {
            return;
        }

        // SEND EXISTING PARTICIPANTS TO NEW USER
        socket.emit(
            "call-existing-peers",
            rooms[roomId].callUsers
        );

        // ADD USER TO VIDEO CALL
        rooms[roomId].callUsers.push({
            id: socket.id,
            username: socket.username
        });

        // NOTIFY OTHER PARTICIPANTS
        socket.to(roomId).emit("call-peer-joined", {
            id: socket.id,
            username: socket.username
        });

        console.log(
            socket.username + " joined the video call in " + roomId
        );
    });

    // =================================
    // WEBRTC OFFER
    // =================================

    socket.on("webrtc-offer", (data) => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId] || !data?.target) return;

        const callUsers = rooms[roomId].callUsers || [];

        const isTargetInCall = callUsers.some(
            user => user.id === data.target
        );

        const isSenderInCall = callUsers.some(
            user => user.id === socket.id
        );

        if (!isTargetInCall || !isSenderInCall) return;

        io.to(data.target).emit("webrtc-offer", {
            from: socket.id,
            username: socket.username,
            offer: data.offer
        });
    });

    // =================================
    // WEBRTC ANSWER
    // =================================

    socket.on("webrtc-answer", (data) => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId] || !data?.target) return;

        const callUsers = rooms[roomId].callUsers || [];

        const isTargetInCall = callUsers.some(
            user => user.id === data.target
        );

        const isSenderInCall = callUsers.some(
            user => user.id === socket.id
        );

        if (!isTargetInCall || !isSenderInCall) return;

        io.to(data.target).emit("webrtc-answer", {
            from: socket.id,
            answer: data.answer
        });
    });

    // =================================
    // WEBRTC ICE CANDIDATE
    // =================================

    socket.on("webrtc-ice-candidate", (data) => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId] || !data?.target) return;

        const callUsers = rooms[roomId].callUsers || [];

        const isTargetInCall = callUsers.some(
            user => user.id === data.target
        );

        const isSenderInCall = callUsers.some(
            user => user.id === socket.id
        );

        if (!isTargetInCall || !isSenderInCall) return;

        io.to(data.target).emit("webrtc-ice-candidate", {
            from: socket.id,
            candidate: data.candidate
        });
    });

    // =================================
    // LEAVE VIDEO CALL
    // =================================

    socket.on("call-leave", () => {

        const roomId = socket.roomId;

        if (!roomId || !rooms[roomId]) return;

        rooms[roomId].callUsers =
            (rooms[roomId].callUsers || []).filter(
                user => user.id !== socket.id
            );

        socket.to(roomId).emit("call-peer-left", {
            id: socket.id
        });

        console.log(
            socket.username + " left the video call in " + roomId
        );
    });

    // =================================
    // USER DISCONNECT
    // =================================

    socket.on("disconnect", () => {

        console.log("User disconnected:", socket.id);

        const roomId = socket.roomId;

        if (roomId && rooms[roomId]) {

            // REMOVE DISCONNECTED USER FROM VIDEO CALL
            rooms[roomId].callUsers =
                (rooms[roomId].callUsers || []).filter(
                    user => user.id !== socket.id
                );

            socket.to(roomId).emit("call-peer-left", {
                id: socket.id
            });

            // REMOVE DISCONNECTED USER
            rooms[roomId].onlineUsers =
                rooms[roomId].onlineUsers.filter(
                    user => user.id !== socket.id
                );

            // CLEAR TYPING INDICATOR
            socket.to(roomId).emit("user-typing", {
                username: socket.username,
                isTyping: false
            });

            // UPDATE ONLINE USERS
            io.to(roomId).emit(
                "online-users",
                rooms[roomId].onlineUsers
            );

            console.log("User left room:", roomId);
        }
    });

});

// =================================
// START SERVER
// =================================

server.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);

    console.log("Socket.IO is ready!");
    console.log("Real-time file sharing is ready!");
    console.log("Online users tracking is ready!");
    console.log("Real-time group chat is ready!");
    console.log("Typing indicator is ready!");
    console.log("WebRTC video call signaling is ready!");

});
