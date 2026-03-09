const video = document.getElementById("video")

// 音声
const audio = document.getElementById("studyVoice")
let audioEnabled = false

// カメラ開始
document.getElementById("startBtn").onclick = async () => {

 const stream = await navigator.mediaDevices.getUserMedia({video:true})
 video.srcObject = stream

 if(!audioEnabled){
   audio.play().then(()=>{
     audio.pause()
     audio.currentTime = 0
     audioEnabled = true
   })
 }

 const camera = new Camera(video,{
   onFrame: async () => {
     await hands.send({image: video})
   },
   width:640,
   height:480
 })

 camera.start()
}

// カメラ停止
document.getElementById("stopBtn").onclick = () => {
 video.srcObject.getTracks().forEach(track => track.stop())
}

// 警告回数
let warnCount = 0

function warn(){
 warnCount++
 document.getElementById("warnCount").innerText = warnCount

 // 音声再生
 if(audioEnabled){
   audio.currentTime = 0
   audio.play()
 }
}

let timerInterval
let timeLeft = 0

document.getElementById("timerStart").onclick = () => {
 const timeInSeconds = parseInt(document.getElementById("timer").value)
 timeLeft = timeInSeconds

 document.getElementById("timerDisplay").style.display = "block"
 document.getElementById("timerDisplay").innerText = timeLeft + "秒"

 timerInterval = setInterval(() => {
   timeLeft--
   document.getElementById("timerDisplay").innerText = timeLeft + "秒"

   if(timeLeft <= 0){
     clearInterval(timerInterval)
     alert("勉強時間終了！")
     document.getElementById("timerDisplay").style.display = "none"
   }

 },1000)

 document.getElementById("timerStart").disabled = true
 document.getElementById("timerPause").disabled = false
 document.getElementById("timerReset").disabled = false
}

document.getElementById("timerPause").onclick = () => {
 clearInterval(timerInterval)
 document.getElementById("timerStart").disabled = false
 document.getElementById("timerPause").disabled = true
}

document.getElementById("timerReset").onclick = () => {
 clearInterval(timerInterval)
 timeLeft = 0
 document.getElementById("timerDisplay").style.display = "none"

 document.getElementById("timerStart").disabled = false
 document.getElementById("timerPause").disabled = true
 document.getElementById("timerReset").disabled = true
}

// ===== MediaPipe Hands =====
const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")

const hands = new Hands({
 locateFile: (file) => {
   return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
 }
})

hands.setOptions({
 maxNumHands: 1,
 modelComplexity: 1,
 minDetectionConfidence: 0.7,
 minTrackingConfidence: 0.7
})

let lastMoveTime = Date.now()
let lastX = null
let lastY = null

hands.onResults(results => {

 ctx.clearRect(0,0,canvas.width,canvas.height)

 if(results.multiHandLandmarks.length > 0){

   const hand = results.multiHandLandmarks[0]
   const x = hand[8].x
   const y = hand[8].y

   if(lastX !== null){

     const dx = Math.abs(x - lastX)
     const dy = Math.abs(y - lastY)

     if(dx > 0.01 || dy > 0.01){
       lastMoveTime = Date.now()
     }

   }

   lastX = x
   lastY = y

 }

 // 5秒動いてない
 if(Date.now() - lastMoveTime > 5000){
   warn()
   lastMoveTime = Date.now()
 }

})
