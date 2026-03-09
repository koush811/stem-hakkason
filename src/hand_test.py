import winsound
import cv2
import mediapipe as mp
import time

mp_hands = mp.solutions.hands
hands = mp_hands.Hands()
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)

prev_x = 0
prev_y = 0

last_move_time = time.time()
warning_played = False

while True:
    ret, frame = cap.read()
    if not ret:
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb)

    if results.multi_hand_landmarks:
        for handLms in results.multi_hand_landmarks:

            h, w, c = frame.shape
            cx = int(handLms.landmark[8].x * w)
            cy = int(handLms.landmark[8].y * h)

            movement = abs(cx - prev_x) + abs(cy - prev_y)

            if movement > 10:
                last_move_time = time.time()
                warning_played = False   # 動いたらリセット

            prev_x = cx
            prev_y = cy

            mp_draw.draw_landmarks(frame, handLms, mp_hands.HAND_CONNECTIONS)

    idle_time = time.time() - last_move_time

    if idle_time > 5:
        cv2.putText(frame, "STUDY NOW!!", (50, 50),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1, (0, 0, 255), 3)

        if not warning_played:
            winsound.PlaySound("0309.wav", winsound.SND_FILENAME)
            warning_played = True

    cv2.imshow("Study Monitor", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()