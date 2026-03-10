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
 cameraActive = false
 updateStartButtonState()
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

 // localStorage に記録
 const today = new Date().toLocaleDateString("ja-JP")
 const key = "saboCount_" + today
 const prev = parseInt(localStorage.getItem(key) || "0")
 localStorage.setItem(key, prev + 1)

 const totalKey = "saboCount_total"
 const prevTotal = parseInt(localStorage.getItem(totalKey) || "0")
 localStorage.setItem(totalKey, prevTotal + 1)

 updateSaboStats()

 if(audioEnabled){
   audio.currentTime = 0
   audio.play()
 }

}

function updateSaboStats(){
 const today = new Date().toLocaleDateString("ja-JP")
 const todayCount = parseInt(localStorage.getItem("saboCount_" + today) || "0")
 const totalCount = parseInt(localStorage.getItem("saboCount_total") || "0")

 const el = document.getElementById("saboStats")
 if(el){
   el.innerText = `今日のさぼり: ${todayCount}回 ／ 累計さぼり: ${totalCount}回`
 }
}

updateSaboStats()


// ==========================
// タイマー
// ==========================

let timerInterval = null
let timeLeft = 0
let isRunning = false
let isPaused = false
// タイマーに入力された分数（記録用）
let timerSetMinutes = 0

document.getElementById("timerStart").onclick = ()=>{

 if(isRunning) return

 const minutes = parseInt(document.getElementById("timer").value)

 if(isNaN(minutes) || minutes <= 0) return

 timeLeft = minutes * 60
 timerSetMinutes = minutes  // 設定分数を保持

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

       // タイマーに入力した分数をそのまま記録
       saveStudyTime(timerSetMinutes)

       document.getElementById("timerPause").disabled = true
       document.getElementById("timerReset").disabled = true
       updateStartButtonState()

       resetCountdown()

     }

   }

 },1000)

}


function saveStudyTime(minutes){
 const today = new Date().toLocaleDateString("ja-JP")
 const key = "studyTime_" + today
 const prev = parseInt(localStorage.getItem(key) || "0")
 localStorage.setItem(key, prev + minutes)

 const totalKey = "studyTime_total"
 const prevTotal = parseInt(localStorage.getItem(totalKey) || "0")
 localStorage.setItem(totalKey, prevTotal + minutes)

 // テーブルに記録を追加・更新
 addStudyRecord(today, prev + minutes)

 updateStudyTimeStats()
}

function addStudyRecord(date, totalMinutes){
 const historyBody = document.getElementById("historyBody")
 if(!historyBody) return

 const existingRow = Array.from(historyBody.querySelectorAll("tr")).find(
   row => row.cells[0].innerText === date
 )

 if(existingRow){
   existingRow.cells[1].innerText = `${totalMinutes}分`
   existingRow.cells[2].innerText = warnCount
 } else {
   const row = historyBody.insertRow()
   row.insertCell(0).innerText = date
   row.insertCell(1).innerText = `${totalMinutes}分`
   row.insertCell(2).innerText = warnCount
 }
}

function updateStudyTimeStats(){
 const today = new Date().toLocaleDateString("ja-JP")
 const todayMin = parseInt(localStorage.getItem("studyTime_" + today) || "0")
 const totalMin = parseInt(localStorage.getItem("studyTime_total") || "0")

 const el = document.getElementById("studyStats")
 if(el){
   el.innerText = `今日の勉強: ${todayMin}分 ／ 累計勉強: ${totalMin}分`
 }
}

updateStudyTimeStats()


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
   el.innerText = `⚠️ 手が止まっています… ${countdownLeft}秒`
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

 if(!isRunning || isPaused){
   resetCountdown()
   statusText.innerText = ""
   return
 }

 if(results.multiHandLandmarks.length > 0){

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

 } else {
   // 手が映っていない場合も静止扱い
 }

 // 5秒以上動きがない場合にカウントダウン開始
 if(Date.now() - lastMoveTime > 5000){
   statusText.innerText = "手が止まっています"
   startCountdown()
   lastMoveTime = Date.now()
 }

})