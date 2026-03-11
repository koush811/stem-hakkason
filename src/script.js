const video = document.getElementById("video")
const audio = document.getElementById("studyVoice")
const cameraSelect = document.getElementById("cameraSelect")
const statusText = document.getElementById("statusText")

let audioEnabled = false
let currentStream = null
let camera = null
let cameraActive = false



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

 if(cameraSelect.options.length > 0){
   cameraSelect.value = cameraSelect.options[0].value
 }

 console.log("検出されたカメラ:", cameras.map(c => ({
   label: c.label,
   id: c.deviceId
 })))

}

loadCameras()

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
 ctx.clearRect(0,0,canvas.width,canvas.height)
 cameraActive = false
 updateStartButtonState()
}


// ==========================
// カメラON
// ==========================

document.getElementById("startBtn").onclick = async ()=>{
 try{
   if(currentStream){
     currentStream.getTracks().forEach(track=>track.stop())
   }
   if(camera){
     camera.stop()
   }

   const deviceId = cameraSelect.value

   const constraints = {
     video:{
       deviceId:{exact:deviceId},
       width: { ideal: 640 },
       height: { ideal: 480 }
     }
   }

   const stream = await navigator.mediaDevices.getUserMedia(constraints)

   video.srcObject = stream
   currentStream = stream
   cameraActive = true
   updateStartButtonState()

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
 ctx.clearRect(0,0,canvas.width,canvas.height)
 cameraActive = false
 updateStartButtonState()

}


// ==========================
// スタートボタンの有効・無効制御
// ==========================

function updateStartButtonState(){
 const timerVal = parseInt(document.getElementById("timer").value)
 const timerFilled = !isNaN(timerVal) && timerVal > 0
 document.getElementById("timerStart").disabled = !(cameraActive && timerFilled)
}

document.getElementById("timer").oninput = ()=>{
 updateStartButtonState()
}

updateStartButtonState()


// ==========================
// 警告
// ==========================

let warnCount = 0

function warn(){
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
let timerSetMinutes = 0

document.getElementById("timerStart").onclick = ()=>{

 if(isRunning) return

 const minutes = parseInt(document.getElementById("timer").value)

 if(isNaN(minutes) || minutes <= 0) return

 timeLeft = minutes * 60
 timerSetMinutes = minutes

 document.getElementById("timerDisplay").style.display = "block"
 document.getElementById("timerDisplay").style.color = "red"

 isRunning = true
 isPaused = false

 document.getElementById("timerPause").disabled = false
 document.getElementById("timerReset").disabled = false
 document.getElementById("timerPause").innerText = "一時停止"
 document.getElementById("timerStart").disabled = true

 timerInterval = setInterval(()=>{

   if(!isPaused){

     timeLeft--

     const min = Math.floor(timeLeft / 60)
     const sec = timeLeft % 60

     document.getElementById("timerDisplay").innerText =
       `残り ${min}:${sec.toString().padStart(2,"0")}`

     if(timeLeft <= 0){

       clearInterval(timerInterval)

       isRunning = false

       document.getElementById("timerDisplay").innerText = "勉強時間終了"

       // セッションごとに記録（合算しない）
       saveStudyRecord(timerSetMinutes, warnCount)

       document.getElementById("timerPause").disabled = true
       document.getElementById("timerReset").disabled = true
       updateStartButtonState()

       resetCountdown()

     }

   }

 },1000)

}


// ==========================
// 勉強記録の保存（セッションごと・合算しない）
// ==========================

function saveStudyRecord(minutes, saboriCount){
  const now = new Date()
  const dateStr = now.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }) + " " + now.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  })

  const id = "record_" + now.getTime()

  const record = {
    id: id,
    date: dateStr,
    minutes: minutes,
    sabori: saboriCount
  }

  const allRecords = getRecords()
  allRecords.push(record)
  localStorage.setItem("studyRecords", JSON.stringify(allRecords))

  addRowToTable(record)
}

function getRecords(){
  try {
    return JSON.parse(localStorage.getItem("studyRecords") || "[]")
  } catch {
    return []
  }
}

function addRowToTable(record){
  const historyBody = document.getElementById("historyBody")
  if(!historyBody) return

  const row = historyBody.insertRow()
  row.setAttribute("data-id", record.id)

  const cellDate = row.insertCell(0)
  const cellMin  = row.insertCell(1)
  const cellSabo = row.insertCell(2)
  const cellDel  = row.insertCell(3)

  cellDate.innerText = record.date
  cellMin.innerText  = `${record.minutes}分`
  cellSabo.innerText = `${record.sabori}回`

  const delBtn = document.createElement("button")
  delBtn.innerText = "削除"
  delBtn.className = "deleteBtn"
  delBtn.onclick = ()=>{
    deleteRecord(record.id, row)
  }
  cellDel.appendChild(delBtn)
}

function deleteRecord(id, row){
  if(!confirm("このデータを削除しますか？")) return
  const allRecords = getRecords().filter(r => r.id !== id)
  localStorage.setItem("studyRecords", JSON.stringify(allRecords))
  row.remove()
}

// ページ読み込み時に記録を復元
function loadRecords(){
  const allRecords = getRecords()
  allRecords.forEach(record => addRowToTable(record))
}

loadRecords()


// ===== データリセット =====
document.getElementById("clearStorageBtn").onclick = () => {
 if(confirm("本当にすべてのデータをリセットしますか？")){
   localStorage.clear()
   location.reload()
 }
}


// ===== 一時停止 =====

document.getElementById("timerPause").onclick = ()=>{

 if(isRunning){

   if(!isPaused){

     isPaused = true
     document.getElementById("timerPause").innerText = "再開"
     resetCountdown()

   }else{

     isPaused = false
     document.getElementById("timerPause").innerText = "一時停止"
     lastMoveTime = Date.now()
     lastX = null
     lastY = null

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

 updateStartButtonState()

 warnCount = 0
 document.getElementById("warnCount").innerText = "0"

 resetCountdown()

}


// ==========================
// 5秒カウントダウン
// ==========================

let countdownInterval = null
let countdownLeft = -1

function startCountdown(){
 if(countdownInterval !== null) return
 if(!isRunning || isPaused) return

 countdownLeft = 5
 updateCountdownDisplay()

 countdownInterval = setInterval(()=>{
   if(!isRunning || isPaused){
     resetCountdown()
     return
   }

   countdownLeft--
   updateCountdownDisplay()

   if(countdownLeft <= 0){
     clearInterval(countdownInterval)
     countdownInterval = null
     countdownLeft = -1
     document.getElementById("countdownDisplay").innerText = ""
     warn()
     lastMoveTime = Date.now()
   }
 }, 1000)
}

function resetCountdown(){
 if(countdownInterval !== null){
   clearInterval(countdownInterval)
   countdownInterval = null
 }
 countdownLeft = -1
 const el = document.getElementById("countdownDisplay")
 if(el) el.innerText = ""
}

function updateCountdownDisplay(){
 const el = document.getElementById("countdownDisplay")
 if(el && countdownLeft > 0){
   el.innerText = `手が止まっています… ${countdownLeft}秒`
 }
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

 canvas.width = video.videoWidth
 canvas.height = video.videoHeight

 ctx.save()
 ctx.clearRect(0,0,canvas.width,canvas.height)

 ctx.drawImage(video,0,0,canvas.width,canvas.height)

 if(!isRunning || isPaused){
   resetCountdown()
   statusText.innerText = ""
   ctx.restore()
   return
 }

 if(results.multiHandLandmarks && results.multiHandLandmarks.length > 0){

   const hand = results.multiHandLandmarks[0]

   const x = hand[8].x
   const y = hand[8].y

   if(lastX !== null){

     const dx = Math.abs(x-lastX)
     const dy = Math.abs(y-lastY)

     if(dx > 0.02 || dy > 0.02){
       lastMoveTime = Date.now()
       statusText.innerText = ""
       resetCountdown()
     }

   }

   lastX = x
   lastY = y

   for(const landmarks of results.multiHandLandmarks){

     drawConnectors(ctx, landmarks, HAND_CONNECTIONS,{
       color:"#9c9c9c",
       lineWidth:4
     })

     drawLandmarks(ctx, landmarks,{
       color:"#FF0000",
       lineWidth:2
     })

   }

 }

 if(Date.now() - lastMoveTime > 5000){
   startCountdown()
   lastMoveTime = Date.now()
 }

 ctx.restore()

})