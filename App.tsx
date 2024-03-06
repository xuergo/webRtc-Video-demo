import React, { useEffect, useRef, useState } from 'react'
import { Button, View, Text } from 'react-native'
import { RTCPeerConnection, RTCView, mediaDevices } from 'react-native-webrtc'

const App = () => {
  const [localStream, setLocalStream] = useState<any>(null)
  const [remoteStream, setRemoteStream] = useState<any>(null)
  const localStreamRef = useRef<any>()
  const pc1 = useRef<any>(null)
  const pc2 = useRef<any>(null)

  const offerOptions = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1
  }

  const getName = (pc: any) => {
    return (pc === pc1.current) ? 'pc1.current' : 'pc2.current'
  }

  const getOtherPc = (pc: any) => {
    return (pc === pc1.current) ? pc2.current : pc1.current
  }
  const start = async () => {
    // console.log("Requesting local stream")
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: true
    })
    localStreamRef.current = stream
    setLocalStream(stream)
  }

  const call = async () => {
    console.log("Starting call")
    const videoTracks = localStreamRef.current.getVideoTracks()
    const audioTracks = localStreamRef.current.getAudioTracks()
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`)
    }
    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`)
    }
    const configuration = {}
    // console.log("RTCPeerConnection configuration:", configuration)
    pc1.current = new RTCPeerConnection(configuration)
    // console.log("Created local peer connection object pc1.current")
    pc1.current.addEventListener("icecandidate", (e: any) => onIceCandidate(pc1.current, e))
    pc2.current = new RTCPeerConnection(configuration)
    // console.log("Created remote peer connection object pc2.current")
    pc2.current.addEventListener("icecandidate", (e: any) => onIceCandidate(pc2.current, e))
    pc1.current.addEventListener("iceconnectionstatechange", (e: any) =>
      onIceStateChange(pc1.current, e)
    )
    pc2.current.addEventListener("iceconnectionstatechange", (e: any) =>
      onIceStateChange(pc2.current, e)
    )
    pc2.current.addEventListener("track", gotRemoteStream)

    localStreamRef.current.getTracks().forEach((track: any) => pc1.current.addTrack(track, localStreamRef.current))
    // console.log("Added local stream to pc1.current")

    try {
      // console.log("pc1.current createOffer start")
      const offer = await pc1.current.createOffer(offerOptions)
      await onCreateOfferSuccess(offer)
    } catch (e) {
      onCreateSessionDescriptionError(e)
    }
  }

  function onCreateSessionDescriptionError(error: any) {
    // console.log(`Failed to create session description: ${error.toString()}`)
  }

  async function onCreateOfferSuccess(desc: any) {
    // console.log(`Offer from pc1.current\n${desc.sdp}`)
    // console.log("pc1.current setLocalDescription start")
    try {
      await pc1.current.setLocalDescription(desc)
      onSetLocalSuccess(pc1.current)
    } catch (e) {
      onSetSessionDescriptionError(e)
    }

    // console.log("pc2.current setRemoteDescription start")
    try {
      await pc2.current.setRemoteDescription(desc)
      onSetRemoteSuccess(pc2.current)
    } catch (e) {
      onSetSessionDescriptionError(e)
    }

    // console.log("pc2.current createAnswer start")
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    try {
      const answer = await pc2.current.createAnswer()
      await onCreateAnswerSuccess(answer)
    } catch (e) {
      onCreateSessionDescriptionError(e)
    }
  }

  const onSetLocalSuccess = (pc: any) => {
    // console.log(`${getName(pc)} setLocalDescription complete`)
  }

  const onSetRemoteSuccess = (pc: any) => {
    // console.log(`${getName(pc)} setRemoteDescription complete`)
  }

  const onSetSessionDescriptionError = (error: any) => {
    console.log(`Failed to set session description: ${error.toString()}`)
  }

  const gotRemoteStream = async (e: any) => {
    let stats = await pc2.current.getStats(e.track)
    console.log('stats', stats)
    setRemoteStream(e.streams[0])
  }

  const onCreateAnswerSuccess = async (desc: any) => {
    // console.log(`Answer from pc2.current:\n${desc.sdp}`)
    // console.log("pc2.current setLocalDescription start")
    try {
      await pc2.current.setLocalDescription(desc)
      onSetLocalSuccess(pc2.current)
    } catch (e) {
      onSetSessionDescriptionError(e)
    }
    // console.log("pc1.current setRemoteDescription start")
    try {
      await pc1.current.setRemoteDescription(desc)
      onSetRemoteSuccess(pc1.current)
    } catch (e) {
      onSetSessionDescriptionError(e)
    }
  }

  const onIceCandidate = async (pc: any, event: any) => {
    try {
      await getOtherPc(pc).addIceCandidate(event.candidate)
      onAddIceCandidateSuccess(pc)
    } catch (e) {
      onAddIceCandidateError(pc, e)
    }
    // console.log(
    //   `${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : "(null)"
    //   }`
    // )
  }

  const onAddIceCandidateSuccess = (pc: any) => {
    // console.log(`${getName(pc)} addIceCandidate success`)
  }

  const onAddIceCandidateError = (pc: any, error: any) => {
    // console.log(
    //   `${getName(pc)} failed to add ICE Candidate: ${error.toString()}`
    // )
  }

  const onIceStateChange = (pc: any, event: any) => {
    if (pc) {
      // console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`)
      // console.log("ICE state change event: ", event)
    }
  }

  const hangup = () => {
    // console.log("Ending call")
    pc1.current.close()
    pc2.current.close()
    pc1.current = null
    pc2.current = null
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column'
      }}>


      <View
        style={{
          flexDirection: 'row'
        }}
      >
        <View
          style={{
            width: 160,
            height: 160,
            backgroundColor: 'black'
          }} >
          {localStream && <RTCView
            style={{
              width: 160,
              height: 160,
              backgroundColor: 'black'
            }}
            mirror={true}
            objectFit="cover"
            streamURL={localStream.toURL()}
          />}
        </View>

        <View
          style={{
            marginLeft: 10,
            width: 160,
            height: 160,
            backgroundColor: 'black'
          }}
        >
          {remoteStream && <RTCView
            style={{
              width: 160,
              height: 160
            }}
            mirror={true}
            objectFit="cover"
            streamURL={remoteStream.toURL()}
          />}
        </View>
      </View>



      <View style={{ flexDirection: 'row' }}>
        <Button
          onPress={start}
          title="Start"
        />
        <Button
          onPress={call}
          title="Call"
        />
        <Button
          onPress={hangup}
          title="Hang Up"
        />
      </View>



    </View>
  )
}

export default App
