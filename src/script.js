const video = document.getElementById("video")
const audio = document.getElementById("studyVoice")
const cameraSelect = document.getElementById("cameraSelect")
const statusText = document.getElementById("statusText")

let audioEnabled = false
let currentStream = null
let camera = null



// ==========================
// カメラ一覧取得
// ==========================

async function loadCameras(){

 await navigator.mediaDevices.getUserMedia({video:true})

 const devices = await navigator.mediaDevices.enumerateDevices()

 const cameras = devices.filter(device => device.kind === "videoinput")

 cameraSelect.innerHTML = ""

 cameras.forEach((cam,i)=>{
   const option = document.createElement("option")
   option.value = cam.deviceId
   option.text = cam.label || `Camera ${i+1}`
   cameraSelect.appendChild(option)
 })

 // フロントカメラを最初に選択（または最初のカメラ）
 if(cameraSelect.options.length > 0){
   cameraSelect.value = cameraSelect.options[0].value
 }

 console.log("検出されたカメラ:", cameras.map(c => ({
   label: c.label,
   id: c.deviceId
 })))

}

loadCameras()

// カメラ変更時に現在のストリームを停止
cameraSelect.onchange = ()=>{
 if(currentStream){
   currentStream.getTracks().forEach(track=>track.stop())
   currentStream = null
 }
 if(camera){
   camera.stop()
   camera = null
 }
 video.srcObject = null
}


// ==========================
// カメラON
// ==========================

document.getElementById("startBtn").onclick = async ()=>{
 try{
   // 既に実行中なら停止
   if(currentStream){
     currentStream.getTracks().forEach(track=>track.stop())
   }
   if(camera){
     camera.stop()
   }

   const deviceId = cameraSelect.value
   console.log("選択カメラ:", cameraSelect.options[cameraSelect.selectedIndex].text)
   console.log("選択カメラID:", deviceId)

   const constraints = {
     video:{
       deviceId:{exact:deviceId},
       width: { ideal: 640 },
       height: { ideal: 480 }
     }
   }

   const stream = await navigator.mediaDevices.getUserMedia(constraints)
   console.log("カメラ起動成功")

   video.srcObject = stream
   currentStream = stream

   if(!audioEnabled){
     audio.play().then(()=>{
       audio.pause()
       audio.currentTime = 0
       audioEnabled = true
     }).catch(()=>{})
   }

   camera = new Camera(video,{
     onFrame: async()=>{
       await hands.send({image:video})
     }
   })

   camera.start()
   
 }catch(err){
   console.error("カメラ起動エラー:", err)
   alert("カメラが起動できません: " + err.message)
 }

}


// ==========================
// カメラOFF
// ==========================

document.getElementById("stopBtn").onclick = ()=>{

 if(camera){
   camera.stop()
 }

 if(currentStream){
   currentStream.getTracks().forEach(track=>track.stop())
 }

 video.srcObject = null

}


// ==========================
// 警告
// ==========================

let warnCount = 0

function warn(){
 // タイマーが開始されていない、または一時停止している場合は警告を発生させない
 if(!isRunning || isPaused) return

 warnCount++

 document.getElementById("warnCount").innerText = warnCount

 if(audioEnabled){
   audio.currentTime = 0
   audio.play()
 }

}


// ==========================
// タイマー
// ==========================

let timerInterval = null
let timeLeft = 0
let isRunning = false
let isPaused = false

document.getElementById("timerStart").onclick = ()=>{

 if(isRunning) return

 const minutes = parseInt(document.getElementById("timer").value)

 if(isNaN(minutes) || minutes <= 0) return

 timeLeft = minutes * 60

 document.getElementById("timerDisplay").style.display = "block"

 isRunning = true
 isPaused = false

 document.getElementById("timerPause").disabled = false
 document.getElementById("timerReset").disabled = false
 document.getElementById("timerPause").innerText = "一時停止"

 timerInterval = setInterval(()=>{

   if(!isPaused){

     timeLeft--

     const min = Math.floor(timeLeft / 60)
     const sec = timeLeft % 60

     document.getElementById("timerDisplay").innerText =
       `${min}:${sec.toString().padStart(2,"0")}`

     if(timeLeft <= 0){

       clearInterval(timerInterval)

       isRunning = false

       alert("勉強時間終了")

       document.getElementById("timerPause").disabled = true
       document.getElementById("timerReset").disabled = true

     }

   }

 },1000)

}


// ===== 一時停止 =====

document.getElementById("timerPause").onclick = ()=>{

 if(isRunning){

   if(!isPaused){

     isPaused = true
     document.getElementById("timerPause").innerText = "再開"

   }else{

     isPaused = false
     document.getElementById("timerPause").innerText = "一時停止"

   }

 }

}


// ===== リセット =====

document.getElementById("timerReset").onclick = ()=>{

 clearInterval(timerInterval)

 isRunning = false
 isPaused = false

 timeLeft = 0

 document.getElementById("timerDisplay").style.display = "none"

 document.getElementById("timerPause").disabled = true
 document.getElementById("timerReset").disabled = true
 document.getElementById("timerPause").innerText = "一時停止"

 // さぼり回数もリセット
 warnCount = 0
 document.getElementById("warnCount").innerText = "0"

}



// ==========================
// MediaPipe
// ==========================

const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")

const hands = new Hands({
 locateFile:(file)=>{
   return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
 }
})

hands.setOptions({
 maxNumHands:1,
 modelComplexity:1,
 minDetectionConfidence:0.7,
 minTrackingConfidence:0.7
})

let lastMoveTime = Date.now()
let lastX = null
let lastY = null

hands.onResults(results=>{

 if(results.multiHandLandmarks.length > 0){

   const hand = results.multiHandLandmarks[0]

   const x = hand[8].x
   const y = hand[8].y

   if(lastX !== null){

     const dx = Math.abs(x-lastX)
     const dy = Math.abs(y-lastY)

     // 手の動きの閾値を大きくしてシビアさを調整
     if(dx > 0.02 || dy > 0.02){

       lastMoveTime = Date.now()

       statusText.innerText = ""

     }

   }

   lastX = x
   lastY = y

 }

 // 7秒以上動きがない場合にさぼり判定
 if(Date.now() - lastMoveTime > 7000){

   statusText.innerText = "手が止まっています"

   warn()

   lastMoveTime = Date.now()

 }

})


