import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../index";

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = new RTCPeerConnection(configuration);

const iceGatheringStateChange = () => {
  console.log(
    `ICE gathering state changed: ${peerConnection.iceGatheringState}`
  );
};
const connectionStateChange = () => {
  console.log(`Connection state change: ${peerConnection.connectionState}`);
};
const signalingStateChange = () => {
  console.log(`Signaling state change: ${peerConnection.signalingState}`);
};
const iceConnnectionStateChange = () => {
  console.log(
    `ICE connection state change: ${peerConnection.iceConnectionState}`
  );
};

function registerPeerConnectionListeners() {
  peerConnection.addEventListener(
    "icegatheringstatechange",
    iceGatheringStateChange
  );
  peerConnection.addEventListener(
    "connectionstatechange",
    connectionStateChange
  );
  peerConnection.addEventListener("signalingstatechange", signalingStateChange);
  peerConnection.addEventListener(
    "iceconnectionstatechange ",
    iceConnnectionStateChange
  );
}

function removePeerConnectionListeners() {
  peerConnection.removeEventListener(
    "icegatheringstatechange",
    iceGatheringStateChange
  );
  peerConnection.removeEventListener(
    "connectionstatechange",
    connectionStateChange
  );
  peerConnection.removeEventListener(
    "signalingstatechange",
    signalingStateChange
  );
  peerConnection.removeEventListener(
    "iceconnectionstatechange ",
    iceConnnectionStateChange
  );
}

const Messages = () => {
  const [message, setMessage] = useState("");
  const [dataChannel, setDataChannel] = useState<null | RTCDataChannel>(null);
  const [rooms, setRooms] = useState<string[]>([]);

  useEffect(() => {
    getDocs(collection(db, "calls")).then((c) => {
      const ids: string[] = [];
      c.forEach((line) => {
        ids.push(line.id);
      });
      setRooms(ids);
    });
  }, []);

  useEffect(() => {
    registerPeerConnectionListeners();
    return () => {
      removePeerConnectionListeners();
    };
  }, []);

  const sendMessage = () => {
    if (!dataChannel) {
      return;
    }
    setSentMessages([...sentMessages, message]);
    dataChannel.send(message);
  };

  const createRoom = async () => {
    const callDoc = doc(collection(db, "calls"));
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");
    console.log(callDoc.id);

    // Create data channel
    const sendChannel = peerConnection.createDataChannel("sendDataChannel");
    setDataChannel(sendChannel);

    sendChannel.onopen = () => {
      console.log("Send channel open");
    };

    sendChannel.onclose = () => {
      console.log("Send channel close");
    };

    sendChannel.onmessage = (e) => {
      console.log("Send channel message: ", e.data);
      setReceivedMessages((m) => [...m, e.data]);
    };

    // Collect ICE candidates
    peerConnection.addEventListener("icecandidate", async (e) => {
      if (!e.candidate) {
        console.log("Got final candidate");
        return;
      }
      console.log("Got candidate: ", e.candidate);
      await addDoc(offerCandidates, e.candidate.toJSON());
    });

    // Create offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
      offer: {
        type: offerDescription.type,
        sdp: offerDescription.sdp,
      },
    };

    await setDoc(callDoc, offer);
    console.log(`New room created with SDP offer. Room ID: ${callDoc.id}`);

    // Listen for remote answer
    onSnapshot(callDoc, async (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        console.log("Got remote description: ", data.answer);
        const answerDescription = new RTCSessionDescription(data!.answer);
        await peerConnection.setRemoteDescription(answerDescription);
      }
    });

    // Listen for remote ICE candidates
    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const joinRoom = async () => {
    console.log(rooms);
    const callDoc = doc(collection(db, `calls`), rooms[0]);
    const offerCandidates = collection(callDoc, "offerCandidates");
    const answerCandidates = collection(callDoc, "answerCandidates");

    // Collect ICE candidates
    peerConnection.addEventListener("icecandidate", async (e) => {
      if (!e.candidate) {
        console.log("Got final candidate");
        return;
      }
      console.log("Got candidate: ", e.candidate);
      await addDoc(answerCandidates, e.candidate.toJSON());
    });

    peerConnection.addEventListener("datachannel", (e) => {
      console.log("Got remote datachannel", e);
      setDataChannel(e.channel);
      e.channel.addEventListener("message", (e) => {
        console.log("Message: ", e.data);
        setReceivedMessages((m) => [...m, e.data]);
      });
    });

    const callData = (await getDoc(callDoc)).data();

    if (!callData) {
      return;
    }

    const offerDescription = callData.offer;
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer });

    // Listen to remote ICE candidates
    onSnapshot(offerCandidates, (snapshot) => {
      console.log(snapshot.docChanges());
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          let data = change.doc.data();
          console.log(`Got new remote ICE candidate: ${JSON.stringify(data)}`);
          await peerConnection.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  const [sentMessages, setSentMessages] = useState<string[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);

  return (
    <div>
      <button onClick={createRoom}>Create Room</button>
      <button onClick={joinRoom}>Join Room</button>
      <h1>Messages</h1>
      <input type="text" onChange={(e) => setMessage(e.target.value)} />
      <button onClick={sendMessage}>Submit</button>
      <ul>
        <h1>Sent Messages</h1>
        {sentMessages.map((m) => {
          return <p>{m}</p>;
        })}
      </ul>
      <ul>
        <h1>Received Messages</h1>
        {receivedMessages.map((m) => {
          return <p>{m}</p>;
        })}
      </ul>
    </div>
  );
};

export default Messages;
