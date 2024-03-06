import { useState, useRef } from "react";
import { View, StyleSheet, Button, Text } from "react-native";
import { RTCPeerConnection, RTCView } from "react-native-webrtc";
import Video from "react-native-video";
import debug from "debug";
debug.disable("rn-webrtc:*");

export default function App() {
  const talkVideo = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [source, setSource] = useState(null);

  const initVideo = require("./assets/or_idle.mp4");

  const DID_API = {
    key: "Y2l2aXJhOTIzOEB0cmFja2Rlbi5jb20:AkDxVwSYCebpSFZNdsVGO",
    url: "https://api.d-id.com",
  };

  if (DID_API.key == "🤫")
    alert("Please put your api key inside ./api.json and restart..");

  const peerConnection = useRef(null);
  const streamId = useRef(null);
  const sessionId = useRef(null);
  const sessionClientAnswer = useRef(null);
  const statsIntervalId = useRef(null);
  const videoIsPlaying = useRef(null);
  const lastBytesReceived = useRef(null);

  // talkVideo.current.setAttribute("playsinline", "");

  const [streamingStatusLabel, setStreamingStatusLabel] = useState("");
  const [signalingStatusLabel, setSignalingStatusLabel] = useState("");
  const [iceGatheringStatusLabel, setIceGatheringStatusLabel] = useState("");
  const [iceStatusLabel, setIceStatusLabel] = useState("");
  const [peerStatusLabel, setPeerStatusLabel] = useState("");

  connectButton = async () => {
    if (
      peerConnection.current &&
      peerConnection.current.connectionState === "connected"
    ) {
      return;
    }

    stopAllStreams();
    closePC();

    const sessionResponse = await fetchWithRetries(
      `${DID_API.url}/talks/streams`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_url:
            "https://d-id-public-bucket.s3.amazonaws.com/or-roman.jpg",
        }),
      }
    );

    const {
      id: newStreamId,
      offer,
      ice_servers: iceServers,
      session_id: newSessionId,
    } = await sessionResponse.json();
    streamId.current = newStreamId;
    sessionId.current = newSessionId;

    try {
      sessionClientAnswer.current = await createPeerConnection(
        offer,
        iceServers
      );
    } catch (e) {
      console.log("error during streaming setup", e);
      stopAllStreams();
      closePC();
      return;
    }

    const sdpResponse = await fetch(
      `${DID_API.url}/talks/streams/${streamId.current}/sdp`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: sessionClientAnswer.current,
          session_id: sessionId.current,
        }),
      }
    );
  };

  talkButton = async () => {
    if (
      peerConnection.current?.signalingState === "stable" ||
      peerConnection.current?.iceConnectionState === "connected"
    ) {
      const talkResponse = await fetchWithRetries(
        `${DID_API.url}/talks/streams/${streamId.current}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${DID_API.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script: {
              type: "audio",
              audio_url:
                "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/webrtc.mp3",
            },
            driver_url: "bank://lively/",
            config: {
              stitch: true,
            },
            session_id: sessionId.current,
          }),
        }
      );
    }
  };

  destroyButton = async () => {
    await fetch(`${DID_API.url}/talks/streams/${streamId.current}`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId.current }),
    });

    stopAllStreams();
    closePC();
  };

  function onIceGatheringStateChange() {
    setIceGatheringStatusLabel(peerConnection.current.iceGatheringState);
  }
  function onIceCandidate(event) {
    if (event.candidate) {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

      fetch(`${DID_API.url}/talks/streams/${streamId.current}/ice`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: sessionId.current,
        }),
      });
    }
  }
  function onIceConnectionStateChange() {
    setIceStatusLabel(peerConnection.current.iceConnectionState);
    if (
      peerConnection.current.iceConnectionState === "failed" ||
      peerConnection.current.iceConnectionState === "closed"
    ) {
      stopAllStreams();
      closePC();
    }
  }
  function onConnectionStateChange() {
    // not supported in firefox
    setPeerStatusLabel(peerConnection.current.connectionState);
  }
  function onSignalingStateChange() {
    setSignalingStatusLabel(peerConnection.current.signalingState);
  }

  function onVideoStatusChange(videoIsPlaying, stream) {
    let status;
    if (videoIsPlaying) {
      status = "streaming";
      const remoteStream = stream;
      setVideoElement(remoteStream);
    } else {
      status = "empty";
      playIdleVideo();
    }
    setStreamingStatusLabel(status);
  }

  function onTrack(event) {
    /**
     * The following code is designed to provide information about wether currently there is data
     * that's being streamed - It does so by periodically looking for changes in total stream data size
     *
     * This information in our case is used in order to show idle video while no talk is streaming.
     * To create this idle video use the POST https://api.d-id.com/talks endpoint with a silent audio file or a text script with only ssml breaks
     * https://docs.aws.amazon.com/polly/latest/dg/supportedtags.html#break-tag
     * for seamless results use `config.fluent: true` and provide the same configuration as the streaming video
     */

    if (!event.track) return;

    statsIntervalId.current = setInterval(async () => {
      if (!peerConnection.current) return;
      const stats = await peerConnection.current.getStats(event.track);
      // console.log('====================================');
      // console.log(stats);
      // console.log('====================================');
      stats.forEach((report) => {
        if (report.type === "inbound-rtp" && report.mediaType === "video") {
          const videoStatusChanged =
            videoIsPlaying.current !==
            report.bytesReceived > lastBytesReceived.current;

          // console.log("videoIsPlaying.current", videoIsPlaying.current);
          // console.log("report.bytesReceived", report.bytesReceived);
          // console.log("lastBytesReceived.current", lastBytesReceived.current);

          if (videoStatusChanged) {
            console.log("4");
            videoIsPlaying.current =
              report.bytesReceived > lastBytesReceived.current;
            setRemoteStream(event.streams[0]);
            // onVideoStatusChange(videoIsPlaying.current, event.streams[0]);
          }
          lastBytesReceived.current = report.bytesReceived;
        }
      });
    }, 500);
  }

  async function createPeerConnection(offer, iceServers) {
    if (!peerConnection.current) {
      peerConnection.current = new RTCPeerConnection({ iceServers });
      peerConnection.current.addEventListener(
        "icegatheringstatechange",
        onIceGatheringStateChange,
        true
      );
      peerConnection.current.addEventListener(
        "icecandidate",
        onIceCandidate,
        true
      );
      peerConnection.current.addEventListener(
        "iceconnectionstatechange",
        onIceConnectionStateChange,
        true
      );
      peerConnection.current.addEventListener(
        "connectionstatechange",
        onConnectionStateChange,
        true
      );
      peerConnection.current.addEventListener(
        "signalingstatechange",
        onSignalingStateChange,
        true
      );
      peerConnection.current.addEventListener("track", onTrack, true);
    }

    await peerConnection.current.setRemoteDescription(offer);
    console.log("set remote sdp OK");

    const sessionClientAnswer = await peerConnection.current.createAnswer();
    console.log("create local sdp OK");

    await peerConnection.current.setLocalDescription(sessionClientAnswer);
    console.log("set local sdp OK");

    return sessionClientAnswer;
  }

  function setVideoElement(stream) {
    if (!stream) return;
    talkVideo.current.srcObject = stream;
    talkVideo.current.loop = false;

    // safari hotfix
    if (talkVideo.current.paused) {
      talkVideo.current
        .play()
        .then((_) => {})
        .catch((e) => {});
    }
  }

  function playIdleVideo() {
    talkVideo.current.srcObject = undefined;
    talkVideo.current.loop = true;
    setSource(initVideo);
  }

  function stopAllStreams() {
    if (talkVideo.current.srcObject) {
      console.log("stopping video streams");
      talkVideo.current.srcObject.getTracks().forEach((track) => track.stop());
      talkVideo.current.srcObject = null;
    }
  }

  function closePC(pc = peerConnection.current) {
    if (!pc) return;
    console.log("stopping peer connection");
    pc.close();
    pc.removeEventListener(
      "icegatheringstatechange",
      onIceGatheringStateChange,
      true
    );
    pc.removeEventListener("icecandidate", onIceCandidate, true);
    pc.removeEventListener(
      "iceconnectionstatechange",
      onIceConnectionStateChange,
      true
    );
    pc.removeEventListener(
      "connectionstatechange",
      onConnectionStateChange,
      true
    );
    pc.removeEventListener(
      "signalingstatechange",
      onSignalingStateChange,
      true
    );
    pc.removeEventListener("track", onTrack, true);
    clearInterval(statsIntervalId.current);
    setIceGatheringStatusLabel("");
    setSignalingStatusLabel("");
    setIceStatusLabel("");
    setPeerStatusLabel("");

    console.log("stopped peer connection");
    if (pc === peerConnection.current) {
      peerConnection.current = null;
    }
  }

  const maxRetryCount = 3;
  const maxDelaySec = 4;

  async function fetchWithRetries(url, options, retries = 1) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay =
          Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) *
          1000;

        await new Promise((resolve) => setTimeout(resolve, delay));

        console.log(
          `Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`
        );
        return fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  }

  return (
    <View style={styles.container}>
      <Text>-----初始化视频------</Text>
      <Video ref={talkVideo} source={initVideo} style={styles.video} repeat />
      <Text>-----Stream视频------</Text>
      {remoteStream && (
        <RTCView
          style={styles.video}
          mirror={true}
          streamURL={remoteStream.toURL()}
        />
      )}

      <View style={styles.buttons}>
        <Button title="Connect" onPress={connectButton} />
        <Button title="Start" onPress={talkButton} />
        <Button title="Destroy" onPress={destroyButton} />
      </View>

      <View>
        <Text> removed the wrapping tags</Text>
        <Text> ICE gathering status: {iceGatheringStatusLabel}</Text>
        <Text> ICE status: {iceStatusLabel}</Text>
        <Text> Peer connection status: {peerStatusLabel}</Text>
        <Text> Signaling status: {signalingStatusLabel}</Text>
        <Text> Signaling status: {streamingStatusLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#ecf0f1",
  },
  video: {
    alignSelf: "center",
    width: 320,
    height: 200,
  },
  buttons: {
    marginTop: 20,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});
