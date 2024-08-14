import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import * as webrtc from 'wrtc';
import cors from 'cors';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { MediaStream, RTCTrackEvent } from 'wrtc';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface Room {
  peers: webrtc.RTCPeerConnection[];
  students: string[];
  chats: string[];
  commentsEnabled: boolean;
  senderStream?: MediaStream;
}

interface SDP {
  type: webrtc.RTCSdpType;
  sdp: string;
}

const rooms: Record<string, Room> = {};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/hello', (_: Request, res: Response) => {
  res.send('Hello World!');
});

app.post('/consumer', async (req: Request, res: Response) => {
  const { roomId, sdp }: { roomId: string; sdp: SDP } = req.body;
  console.log(`POST /consumer: roomId=${roomId}, sdp=${JSON.stringify(sdp)}`);

  if (!rooms[roomId]) {
    console.log(`Room ${roomId} not found`);
    return res.status(404).json({ error: 'Room not found' });
  }

  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stunprotocol.org',
      },
    ],
  });

  const desc = new webrtc.RTCSessionDescription(sdp);
  await peer.setRemoteDescription(desc);

  rooms[roomId].senderStream?.getTracks().forEach((track) => {
    peer.addTrack(track, rooms[roomId].senderStream as MediaStream);
  });

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  const payload = {
    sdp: peer.localDescription,
  };

  console.log(`New consumer added to room ${roomId}:`);
  io.to(roomId).emit('student-joined', { id: peer.id });

  res.json(payload);
});

app.post('/broadcast', async (req: Request, res: Response) => {
  const { roomId, sdp }: { roomId: string; sdp: SDP } = req.body;
  console.log(`POST /broadcast: roomId=${roomId}`);

  if (!rooms[roomId]) {
    rooms[roomId] = {
      peers: [],
      students: [],
      chats: [],
      commentsEnabled: true,
    };
    console.log(`Created new room: ${roomId}`);
  }

  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stunprotocol.org',
      },
    ],
  });

  peer.ontrack = (e) => handleTrackEvent(e, peer, roomId);

  const desc = new webrtc.RTCSessionDescription(sdp);
  await peer.setRemoteDescription(desc);

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  const payload = {
    sdp: peer.localDescription,
  };

  console.log(`New broadcast in room ${roomId}:`);
  res.json(payload);
});

io.on('connection', (socket: Socket) => {
  console.log('New client connected', socket.id);

  socket.on('join-room', (roomId: string, userId: string) => {
    console.log(`User ${userId} joining room ${roomId}`);
    if (rooms[roomId]) {
      rooms[roomId].students.push(userId);
      socket.join(roomId);
      io.to(roomId).emit('student-list', rooms[roomId].students);
      io.to(roomId).emit('comments-status', rooms[roomId].commentsEnabled);
      console.log(`Updated room ${roomId} students:`, rooms[roomId].students);
    }
  });

  socket.on(
    'chat-message',
    (roomId: string, sendername: string, message: string) => {
      if (rooms[roomId] && rooms[roomId].commentsEnabled) {
        const chatMessage = `${sendername}: ${message}`;
        console.log(`Chat message in room ${roomId}:`, chatMessage);
        rooms[roomId].chats.push(chatMessage);
        io.to(roomId).emit('chat-message', chatMessage);
        console.log(`Updated room ${roomId} chats:`, rooms[roomId].chats);
      }
    },
  );

  socket.on('toggle-comments', (roomId: string) => {
    if (rooms[roomId]) {
      rooms[roomId].commentsEnabled = !rooms[roomId].commentsEnabled;
      io.to(roomId).emit('comments-status', rooms[roomId].commentsEnabled);
      console.log(
        `Comments status for room ${roomId}:`,
        rooms[roomId].commentsEnabled,
      );
    }
  });

  socket.on('hangup', (roomId: string) => {
    console.log(`Hangup requested for room ${roomId}`);
    if (rooms[roomId]) {
      io.to(roomId).emit('force-disconnect');
      delete rooms[roomId];
      console.log(`Deleted room ${roomId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
  });
});

function handleTrackEvent(
  e: RTCTrackEvent,
  peer: webrtc.RTCPeerConnection,
  roomId: string,
) {
  console.log(`Track event in room ${roomId}:`, e.streams[0]);
  rooms[roomId].senderStream = e.streams[0];
  rooms[roomId].peers.push(peer);
  console.log(`Updated room ${roomId}:`, rooms[roomId]);
}

server.listen(5000, () => console.log('Server started on port 5000'));
