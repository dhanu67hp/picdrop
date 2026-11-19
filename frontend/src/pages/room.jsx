import CollageMaker from "./CollageMaker";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";

const API = "http://localhost:5001";

const formatFile = (file) => ({
  id: file.id,
  name: file.originalName,
  type: file.fileType.startsWith("video") ? "video" : "image",
  src: `${API}/uploads/${encodeURIComponent(file.fileName)}`,
});

// Remote participant video
function RemoteVideo({ stream, username }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="call-video-card">
      <video
        ref={videoRef}
        autoPlay
        playsInline
      />
      <div className="call-video-name">{username}</div>
    </div>
  );
}

function Room() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);

  const roomCode =
    params.get("roomCode") || location.state?.roomCode;

  const roomName =
    params.get("roomName") || location.state?.roomName || "Room";

  const username =
    params.get("username") || location.state?.username || "Guest";

  const [activeTab, setActiveTab] = useState("gallery");
  const [copied, setCopied] = useState(false);
  const [time, setTime] = useState(0);
  const [mediaList, setMediaList] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [typingUsers, setTypingUsers] = useState([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  // VIDEO CALL STATES
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callStatus, setCallStatus] = useState("Not connected");

  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);

  // WEBRTC REFS
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const pendingCandidatesRef = useRef({});

  const goHome = () => navigate("/");

  // TIMER
  useEffect(() => {
    const timer = setInterval(() => {
      setTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds) => {
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${minutes}:${secs}`;
  };

  // LOCAL VIDEO PREVIEW
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // SCROLL CHAT
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // ESCAPE PREVIEW
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") setSelectedMedia(null);
    };

    window.addEventListener("keydown", handleEscape);

    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // =================================
  // SOCKET CONNECTION
  // =================================

  useEffect(() => {
    if (!roomCode) return;

    const socket = io(API);
    socketRef.current = socket;

    // CLOSE A PEER CONNECTION
    const closePeerConnection = (peerId) => {
      const peer = peerConnectionsRef.current[peerId];

      if (peer) {
        peer.ontrack = null;
        peer.onicecandidate = null;
        peer.close();

        delete peerConnectionsRef.current[peerId];
      }

      delete pendingCandidatesRef.current[peerId];

      setRemoteStreams((prev) =>
        prev.filter((item) => item.peerId !== peerId)
      );
    };

    // ADD QUEUED ICE CANDIDATES
    const addPendingCandidates = async (peerId, peer) => {
      const candidates = pendingCandidatesRef.current[peerId] || [];

      for (const candidate of candidates) {
        try {
          await peer.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (err) {
          console.error("ICE candidate error:", err);
        }
      }

      pendingCandidatesRef.current[peerId] = [];
    };

    // CREATE PEER CONNECTION
    const createPeerConnection = (peerId, peerUsername = "Guest") => {
      if (peerConnectionsRef.current[peerId]) {
        return peerConnectionsRef.current[peerId];
      }

      const peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302",
          },
        ],
      });

      peerConnectionsRef.current[peerId] = peer;

      // ADD LOCAL CAMERA AND MICROPHONE TRACKS
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peer.addTrack(track, localStreamRef.current);
        });
      }

      // SEND ICE CANDIDATES
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc-ice-candidate", {
            target: peerId,
            candidate: event.candidate,
          });
        }
      };

      // RECEIVE REMOTE VIDEO AND AUDIO
      peer.ontrack = (event) => {
        const stream =
          event.streams[0] ||
          new MediaStream([event.track]);

        setRemoteStreams((prev) => {
          const existing = prev.find(
            (item) => item.peerId === peerId
          );

          if (existing) {
            return prev.map((item) =>
              item.peerId === peerId
                ? {
                    ...item,
                    stream,
                    username: peerUsername,
                  }
                : item
            );
          }

          return [
            ...prev,
            {
              peerId,
              username: peerUsername,
              stream,
            },
          ];
        });
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          console.error("Connection failed with:", peerId);
          closePeerConnection(peerId);
        }
      };

      return peer;
    };

    // FLUSH ICE CANDIDATES AFTER REMOTE DESCRIPTION
    const flushCandidates = async (peerId, peer) => {
      await addPendingCandidates(peerId, peer);
    };

    // CREATE OFFER FOR EXISTING PARTICIPANT
    const createOffer = async (participant) => {
      try {
        const peer = createPeerConnection(
          participant.id,
          participant.username
        );

        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        socket.emit("webrtc-offer", {
          target: participant.id,
          offer: peer.localDescription,
        });
      } catch (err) {
        console.error("Offer creation failed:", err);
        setError("Could not connect to a call participant.");
      }
    };

    // SOCKET CONNECT
    socket.on("connect", () => {
      socket.emit("join-room", {
        roomId: roomCode,
        username,
      });
    });

    // FILE ADDED
    socket.on("file-added", (file) => {
      const newFile = formatFile(file);

      setMediaList((prev) => {
        if (prev.some((item) => item.id === newFile.id)) return prev;
        return [...prev, newFile];
      });
    });

    // FILE DELETED
    socket.on("file-deleted", ({ id }) => {
      setMediaList((prev) =>
        prev.filter((item) => String(item.id) !== String(id))
      );

      setSelectedMedia((prev) =>
        prev && String(prev.id) === String(id) ? null : prev
      );
    });

    // ONLINE USERS
    socket.on("online-users", (users) => {
      setOnlineUsers(users);
    });

    // CHAT ERROR
    socket.on("chat-error", (message) => {
      setError(message);
    });

    // PREVIOUS MESSAGES
    socket.on("previous-messages", (oldMessages) => {
      setMessages(oldMessages || []);
    });

    // RECEIVE MESSAGE
    socket.on("receive-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // TYPING INDICATOR
    socket.on("user-typing", (data) => {
      if (data.isTyping) {
        setTypingUsers((prev) =>
          prev.includes(data.username)
            ? prev
            : [...prev, data.username]
        );
      } else {
        setTypingUsers((prev) =>
          prev.filter((name) => name !== data.username)
        );
      }
    });

    // =================================
    // WEBRTC SIGNALING LISTENERS
    // =================================

    // NEW USER GETS EXISTING CALL PARTICIPANTS
    socket.on("call-existing-peers", async (participants) => {
      for (const participant of participants) {
        await createOffer(participant);
      }

      setCallStatus(
        participants.length > 0
          ? "Connecting to participants..."
          : "Waiting for others to join..."
      );
    });

    // A NEW PARTICIPANT JOINED
    socket.on("call-peer-joined", (participant) => {
      setCallStatus(
        `${participant.username} joined the video call`
      );
    });

    // RECEIVE OFFER
    socket.on("webrtc-offer", async (data) => {
      try {
        const peer = createPeerConnection(
          data.from,
          data.username
        );

        await peer.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );

        await flushCandidates(data.from, peer);

        const answer = await peer.createAnswer();

        await peer.setLocalDescription(answer);

        socket.emit("webrtc-answer", {
          target: data.from,
          answer: peer.localDescription,
        });

        setCallStatus("Connected to video call");
      } catch (err) {
        console.error("Offer handling failed:", err);
        setError("Could not establish the video connection.");
      }
    });

    // RECEIVE ANSWER
    socket.on("webrtc-answer", async (data) => {
      try {
        const peer = peerConnectionsRef.current[data.from];

        if (!peer) return;

        await peer.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );

        await flushCandidates(data.from, peer);

        setCallStatus("Video call connected");
      } catch (err) {
        console.error("Answer handling failed:", err);
      }
    });

    // RECEIVE ICE CANDIDATE
    socket.on("webrtc-ice-candidate", async (data) => {
      try {
        const peer = peerConnectionsRef.current[data.from];

        if (!peer) return;

        const candidate = new RTCIceCandidate(data.candidate);

        if (peer.remoteDescription?.type) {
          await peer.addIceCandidate(candidate);
        } else {
          if (!pendingCandidatesRef.current[data.from]) {
            pendingCandidatesRef.current[data.from] = [];
          }

          pendingCandidatesRef.current[data.from].push(
            data.candidate
          );
        }
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    });

    // PARTICIPANT LEFT CALL
    socket.on("call-peer-left", (data) => {
      closePeerConnection(data.id);
      setCallStatus("A participant left the call");
    });

    // LOAD EXISTING MEDIA
    const loadFiles = async () => {
      try {
        const response = await fetch(
          `${API}/api/rooms/${roomCode}/files`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Could not load files");
        }

        setMediaList((prev) => {
          const existing = new Map(
            prev.map((file) => [file.id, file])
          );

          (data.files || []).forEach((file) => {
            const formatted = formatFile(file);
            existing.set(formatted.id, formatted);
          });

          return Array.from(existing.values());
        });
      } catch (err) {
        setError(err.message);
      }
    };

    loadFiles();

    return () => {
      clearTimeout(typingTimeoutRef.current);

      // LEAVE VIDEO CALL ON ROOM EXIT
      socket.emit("call-leave");

      Object.values(peerConnectionsRef.current).forEach((peer) => {
        peer.close();
      });

      peerConnectionsRef.current = {};
      pendingCandidatesRef.current = {};

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });

        localStreamRef.current = null;
      }

      socketRef.current = null;
      socket.disconnect();
    };
  }, [roomCode, username]);

  // =================================
  // JOIN VIDEO CALL
  // =================================

  const joinCall = async () => {
    try {
      setError("");

      const socket = socketRef.current;

      if (!socket || !socket.connected) {
        setError("Room connection is not ready. Please try again.");
        return;
      }

      if (isInCall) return;

      setCallStatus("Requesting camera and microphone...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);

      setIsInCall(true);
      setIsMuted(false);
      setIsCameraOff(false);

      setCallStatus("Joining video call...");

      socket.emit("call-join");
    } catch (err) {
      console.error("Camera access error:", err);

      if (err.name === "NotAllowedError") {
        setError("Please allow camera and microphone access.");
      } else if (err.name === "NotFoundError") {
        setError("Camera or microphone not found.");
      } else {
        setError("Could not start video call: " + err.message);
      }

      setCallStatus("Could not join call");
    }
  };

  // =================================
  // LEAVE VIDEO CALL
  // =================================

  const leaveCall = () => {
    socketRef.current?.emit("call-leave");

    Object.values(peerConnectionsRef.current).forEach((peer) => {
      peer.close();
    });

    peerConnectionsRef.current = {};
    pendingCandidatesRef.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      localStreamRef.current = null;
    }

    setLocalStream(null);
    setRemoteStreams([]);
    setIsInCall(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setCallStatus("You left the video call");
  };

  // =================================
  // MUTE / UNMUTE
  // =================================

  const toggleMicrophone = () => {
    if (!localStreamRef.current) return;

    const audioTracks = localStreamRef.current.getAudioTracks();

    audioTracks.forEach((track) => {
      track.enabled = isMuted;
    });

    setIsMuted((prev) => !prev);
  };

  // =================================
  // CAMERA ON / OFF
  // =================================

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    const videoTracks = localStreamRef.current.getVideoTracks();

    videoTracks.forEach((track) => {
      track.enabled = isCameraOff;
    });

    setIsCameraOff((prev) => !prev);
  };

  // =================================
  // TYPING
  // =================================

  const handleTyping = (value) => {
    setNewMessage(value);

    const socket = socketRef.current;
    if (!socket) return;

    if (value.trim()) {
      socket.emit("typing", { roomId: roomCode, username });

      clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stop-typing", { roomId: roomCode, username });
      }, 1000);
    } else {
      clearTimeout(typingTimeoutRef.current);
      socket.emit("stop-typing", { roomId: roomCode, username });
    }
  };

  // =================================
  // SEND MESSAGE
  // =================================

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setError("Chat connection is not available.");
      return;
    }

    socket.emit("stop-typing", { roomId: roomCode, username });
    clearTimeout(typingTimeoutRef.current);

    socket.emit("send-message", newMessage.trim());

    setNewMessage("");
    setError("");
  };

  // =================================
  // UPLOAD MEDIA
  // =================================

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);

    if (!files.length) return;

    setUploading(true);
    setError("");

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `${API}/api/rooms/${roomCode}/upload`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Upload failed");
        }
      }

      alert("Media uploaded successfully!");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // =================================
  // DELETE MEDIA
  // =================================

  const deleteMedia = async (id) => {
    try {
      const response = await fetch(
        `${API}/api/rooms/${roomCode}/files/${id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Delete failed");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // =================================
  // RENDER GALLERY
  // =================================

  const renderGallery = () => (
    <>
      <div className="upload-box">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={handleFileChange}
        />

        <div className="upload-content">
          <div className="upload-icon">📁</div>

          <h3>
            {uploading ? "Uploading media..." : "Share your memories"}
          </h3>

          <p>Select photos or videos to share with everyone.</p>

          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Uploading..." : "＋ Upload Media"}
          </button>

          <small>JPG, PNG, GIF, MP4, WEBM</small>
        </div>
      </div>

      <div className="gallery-header">
        <h2>Shared Gallery</h2>
        <span>{mediaList.length} items</span>
      </div>

      <div className="gallery-grid">
        {mediaList.map((media) => (
          <div className="media-card" key={media.id}>
            <button
              type="button"
              className="media-preview-button"
              onClick={() => setSelectedMedia(media)}
            >
              {media.type === "video" ? (
                <div className="video-thumbnail">
                  <video src={media.src} preload="metadata" muted />
                  <span className="play-icon">▶</span>
                </div>
              ) : (
                <img src={media.src} alt={media.name} />
              )}
            </button>

            <p className="media-file-name">{media.name}</p>

            <div className="media-actions">
              <button onClick={() => setSelectedMedia(media)}>
                👁 Preview
              </button>

              <a
                href={media.src}
                download={media.name}
                className="btn-download-media"
              >
                ⬇ Download
              </a>

              <button
                className="btn-delete-media"
                onClick={() => deleteMedia(media.id)}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        ))}

        {mediaList.length === 0 && (
          <div className="empty-gallery">
            <div>🖼️</div>
            <h3>Your gallery is empty</h3>
            <p>Upload the first photo or video to get started.</p>
          </div>
        )}
      </div>
    </>
  );

  // =================================
  // RENDER CHAT
  // =================================

  const renderChat = () => (
    <div className="chat-section">
      <div className="section-heading">
        <div>
          <h2>Room Chat</h2>
          <p>Talk with everyone in this room.</p>
        </div>

        <span className="chat-online-count">
          {onlineUsers.length} online
        </span>
      </div>

      <div className="chat-messages">
        {messages.map((message, index) => (
          <div
            className={
              message.username === username
                ? "chat-message my-message"
                : "chat-message"
            }
            key={message.id || index}
          >
            <strong>{message.username}</strong>
            <p>{message.text}</p>
            <small>
              {message.time
                ? new Date(message.time).toLocaleTimeString()
                : ""}
            </small>
          </div>
        ))}

        {messages.length === 0 && (
          <div className="empty-chat">
            <div>💬</div>
            <h3>No messages yet</h3>
            <p>Start a conversation with your friends.</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.join(", ")}
          {typingUsers.length === 1 ? " is" : " are"} typing...
        </div>
      )}

      <div className="chat-input-area">
        <input
          type="text"
          placeholder="Write a message..."
          value={newMessage}
          onChange={(e) => handleTyping(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />

        <button
          type="button"
          onClick={sendMessage}
          disabled={!newMessage.trim()}
        >
          Send ➤
        </button>
      </div>
    </div>
  );

  // =================================
  // RENDER MEMBERS
  // =================================

  const renderMembers = () => (
    <div className="members-panel">
      <div className="section-heading">
        <div>
          <h2>Room Members</h2>
          <p>People currently connected to this room.</p>
        </div>

        <span className="chat-online-count">
          {onlineUsers.length} online
        </span>
      </div>

      <div className="members-list">
        {onlineUsers.map((user) => (
          <div className="member-card" key={user.id}>
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>

            <div className="user-details">
              <strong>{user.username}</strong>
              <span>
                <i className="online-dot"></i> Online
              </span>
            </div>
          </div>
        ))}

        {onlineUsers.length === 0 && (
          <p>No members online.</p>
        )}
      </div>
    </div>
  );

  // =================================
  // RENDER VIDEO CALL
  // =================================

  const renderVideoCall = () => (
    <div className="video-call-panel">

      <div className="video-call-heading">
        <div>
          <h2>PicConnect Video Call</h2>
          <p>Connect face-to-face with your room members.</p>
        </div>

        <span className="call-participant-count">
          👥 {remoteStreams.length + (isInCall ? 1 : 0)} in call
        </span>
      </div>

      {!isInCall ? (
        <div className="call-start-screen">
          <div className="video-call-icon">📹</div>

          <h2>Ready to connect?</h2>

          <p>
            Start a video call and invite other members
            from this room.
          </p>

          <button
            type="button"
            className="join-call-button"
            onClick={joinCall}
          >
            📹 Join Video Call
          </button>

          <span className="call-status-text">{callStatus}</span>
        </div>
      ) : (
        <>
          <div className="call-status-bar">
            <span className="call-live-dot"></span>
            {callStatus}
          </div>

          <div className="call-video-grid">

            {/* LOCAL VIDEO */}
            <div className="call-video-card local-video-card">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
              />

              {isCameraOff && (
                <div className="camera-off-overlay">
                  📷 Camera Off
                </div>
              )}

              <div className="call-video-name">
                {username} (You)
              </div>
            </div>

            {/* REMOTE VIDEOS */}
            {remoteStreams.map((participant) => (
              <RemoteVideo
                key={participant.peerId}
                stream={participant.stream}
                username={participant.username}
              />
            ))}

            {remoteStreams.length === 0 && (
              <div className="call-waiting-card">
                <div>👥</div>
                <h3>Waiting for others</h3>
                <p>Share your room code so friends can join.</p>
              </div>
            )}

          </div>

          {/* CALL CONTROLS */}
          <div className="call-controls">

            <button
              type="button"
              className={isMuted ? "call-control active" : "call-control"}
              onClick={toggleMicrophone}
            >
              {isMuted ? "🔇 Unmute" : "🎤 Mute"}
            </button>

            <button
              type="button"
              className={isCameraOff ? "call-control active" : "call-control"}
              onClick={toggleCamera}
            >
              {isCameraOff ? "📷 Camera On" : "📹 Camera Off"}
            </button>

            <button
              type="button"
              className="leave-call-button"
              onClick={leaveCall}
            >
              📞 Leave Call
            </button>

          </div>
        </>
      )}

    </div>
  );

  return (
    <div className="room-page">

      
{/* HEADER */}
<header className="room-header">
  <div className="room-heading">
    <span className="room-eyebrow">YOUR PRIVATE SPACE</span>

    <h1>
      {roomName} <span>Room.</span>
    </h1>

    <p>
      Welcome back, {username}. Make this moment yours.
    </p>
  </div>

  <div className="room-header-actions">

    <div className="room-code">
      <span>ROOM CODE</span>

      <strong>{roomCode}</strong>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(roomCode);
            setCopied(true);

            setTimeout(() => {
              setCopied(false);
            }, 2000);
          } catch (err) {
            setError("Could not copy room code.");
          }
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>

    <button
      type="button"
      className="home-button"
      onClick={goHome}
    >
      ← Home
    </button>

  </div>
</header>


      {/* ROOM INFO */}
      <div className="room-info-bar">
        <span>🟢 {onlineUsers.length} members online</span>
        <span>⏱ {formatTime(time)} elapsed</span>
      </div>

      {/* NAVIGATION TABS */}
      <nav className="room-tabs">
        <button
          className={activeTab === "gallery" ? "active" : ""}
          onClick={() => setActiveTab("gallery")}
        >
          🖼️ Gallery
        </button>
        <button
        className={activeTab === "collage" ? "active" : ""}
        onClick={() => setActiveTab("collage")}
        >
        ✨ Collage Maker
        </button>
        <button
          className={activeTab === "chat" ? "active" : ""}
          onClick={() => setActiveTab("chat")}
        >
          💬 Chat
        </button>

        <button
          className={activeTab === "video" ? "active" : ""}
          onClick={() => setActiveTab("video")}
        >
          📹 Video Call
        </button>

        <button
          className={activeTab === "members" ? "active" : ""}
          onClick={() => setActiveTab("members")}
        >
          👥 Members
        </button>
      </nav>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="room-error">
          {error}
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {/* ACTIVE SECTION */}
      <main className="room-content">
        {activeTab === "collage" && (<CollageMaker mediaList={mediaList} roomCode={roomCode} />)}
        {activeTab === "gallery" && renderGallery()}
        {activeTab === "chat" && renderChat()}
        {activeTab === "video" && renderVideoCall()}
        {activeTab === "members" && renderMembers()}
      </main>

      {/* MEDIA PREVIEW */}
      {selectedMedia && (
        <div
          className="media-modal"
          onClick={() => setSelectedMedia(null)}
        >
          <div
            className="media-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="media-modal-header">
              <h3>{selectedMedia.name}</h3>

              <button
                className="close-media-modal"
                onClick={() => setSelectedMedia(null)}
              >
                ✕
              </button>
            </div>

            <div className="media-modal-body">
              {selectedMedia.type === "video" ? (
                <video
                  src={selectedMedia.src}
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={selectedMedia.src}
                  alt={selectedMedia.name}
                />
              )}
            </div>

            <div className="media-modal-footer">
              <a
                href={selectedMedia.src}
                download={selectedMedia.name}
                className="btn-download-media"
              >
                ⬇ Download
              </a>

              <button onClick={() => setSelectedMedia(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Room;
